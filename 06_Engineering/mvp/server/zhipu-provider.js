import {
  CLAIM_TYPE,
  READINESS_ROUTE,
  SOURCE_TYPE,
  createClaim,
  createTurn
} from '../src/domain.js';
import { DreamOSAiProvider } from '../src/ai-provider.js';

const routes = new Set(Object.values(READINESS_ROUTE));

function jsonText(value) {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch { throw new Error('AI_INVALID_JSON'); }
}

const safetyAndScope = [
  '你是 Dream OS 的梦境澄清助手，不是心理诊断或治疗工具。',
  '只根据用户提供的梦、回答和明确引用给出阶段性理解，不把象征词典当作个人事实。',
  '把观察、假设和不确定性分开；不要下诊断、预测或制造确定性。',
  '若出现现实中的自伤、他伤或即时危险，优先建议用户联系当地紧急服务或可信任的人。',
  '输出必须是合法 JSON，不要 Markdown 代码围栏。'
].join('\n');

function messageText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(item => item?.text || '').join('');
  return '';
}

/**
 * Zhipu GLM adapter. The key stays on the server and the rest of Dream OS
 * only depends on the provider interface from src/ai-provider.js.
 */
export class ZhipuDreamProvider extends DreamOSAiProvider {
  constructor({
    apiKey = process.env.ZHIPU_API_KEY,
    model = process.env.ZHIPU_MODEL || 'glm-5.2',
    baseUrl = process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    jsonMode = process.env.ZHIPU_JSON_MODE !== 'false'
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.jsonMode = jsonMode;
  }

  ensureConfigured() {
    if (!this.apiKey) throw new Error('ZHIPU_API_KEY_MISSING');
  }

  async request(instruction, payload) {
    this.ensureConfigured();
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: `${safetyAndScope}\n\n${instruction}` },
        { role: 'user', content: JSON.stringify(payload) }
      ],
      temperature: 0.3,
      stream: false
    };
    if (this.jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `ZHIPU_API_${response.status}`;
      throw new Error(message);
    }
    return jsonText(messageText(data));
  }

  async assessReadiness({ dream, additions = [] } = {}) {
    const result = await this.request(
      '判断这段材料目前应走哪条流程。返回：{route, hardGateResults, dimensions, supportingEvidence, missingInformation, alternativeExplanations, clarificationBudget, decisionReason}。route 只能是 ANALYSIS_READY、NEEDS_CLARIFICATION、RECORD_FIRST、BODY_CONTEXT_FIRST、SAFETY_REVIEW。不要因为一个常见意象就判定有心理含义。',
      { dream: dream?.raw || null, additions }
    );
    return {
      schemaVersion: 'dream-os-ai-1.0',
      modelVersion: this.model,
      route: routes.has(result?.route) ? result.route : READINESS_ROUTE.RECORD_FIRST,
      hardGateResults: result?.hardGateResults || { minimumMaterial: true, safety: true, bodyContext: true, userConsent: true },
      dimensions: result?.dimensions || {},
      supportingEvidence: Array.isArray(result?.supportingEvidence) ? result.supportingEvidence : [],
      missingInformation: Array.isArray(result?.missingInformation) ? result.missingInformation : [],
      alternativeExplanations: Array.isArray(result?.alternativeExplanations) ? result.alternativeExplanations : [],
      clarificationBudget: Number.isFinite(result?.clarificationBudget) ? result.clarificationBudget : 0,
      decisionReason: String(result?.decisionReason || '先保留记录，等待更多可核对材料。')
    };
  }

  async startSession({ dream } = {}) {
    const result = await this.request(
      '为理解会话生成第一个澄清问题。返回：{question, purpose, options:[{id,label,detail}]}。只问一个最有信息量的问题，选项最多 3 个；问题与梦中已有材料直接相关。',
      { dream: dream?.raw || null }
    );
    return {
      turn: createTurn({ speaker: 'AI', content: result?.question || '回到这个画面时，哪种感受最接近你？', purpose: result?.purpose || 'AFFECT', source: SOURCE_TYPE.AI_OBSERVATION, sequence: 1 }),
      options: Array.isArray(result?.options) ? result.options.slice(0, 3) : [],
      modelVersion: this.model
    };
  }

  async continueSession({ session, userTurn } = {}) {
    const result = await this.request(
      '根据会话历史生成下一个澄清问题。返回：{question,purpose,options:[{id,label,detail}]}。如果问题已足够，仍返回一个用于核对现实联系的问题；选项最多 3 个。',
      { turns: session?.turns || [], latestUserTurn: userTurn || null }
    );
    return {
      turn: createTurn({ speaker: 'AI', content: result?.question || '现实里最近有没有相似的感受？', purpose: result?.purpose || 'CLARIFY', source: SOURCE_TYPE.AI_OBSERVATION, sequence: (session?.turns || []).length + 1 }),
      options: Array.isArray(result?.options) ? result.options.slice(0, 3) : [],
      modelVersion: this.model,
      sourceTurnId: userTurn?.id || null
    };
  }

  async formulateUnderstanding({ dream, session } = {}) {
    const result = await this.request(
      '整理阶段性理解。返回：{summary,claims:[{type,text,evidence:[{sourceType,sourceId,excerpt,relation}],alternativeExplanations}]}。claim.type 只能是 OBSERVATION、HYPOTHESIS、UNCERTAINTY、WATCH_ITEM。至少保留一个不确定性；每条引用必须来自输入中的原文或用户回答。',
      { dream: dream?.raw || null, turns: session?.turns || [] }
    );
    const claims = Array.isArray(result?.claims) ? result.claims : [];
    return {
      version: 1,
      claims: claims.slice(0, 6).map(claim => createClaim({
        type: Object.values(CLAIM_TYPE).includes(claim?.type) ? claim.type : CLAIM_TYPE.UNCERTAINTY,
        text: claim?.text || '目前还不能确定这段梦对你个人意味着什么。',
        evidence: Array.isArray(claim?.evidence) ? claim.evidence : [],
        alternativeExplanations: Array.isArray(claim?.alternativeExplanations) ? claim.alternativeExplanations : []
      })),
      summary: String(result?.summary || '这是一份基于当前材料的阶段性理解。'),
      modelVersion: this.model
    };
  }

  async respondToSupplement({ dream, session, text } = {}) {
    const result = await this.request(
      '回应用户对理解草稿的补充。返回：{reply}。只回应当前补充，明确这是可修正的阶段性理解，不做诊断。',
      { dream: dream?.raw || null, turns: session?.turns || [], supplement: text || '' }
    );
    return {
      turn: createTurn({ speaker: 'AI', content: result?.reply || '我记下了这段补充。它会作为下一版理解的依据。', purpose: 'REFLECT', source: SOURCE_TYPE.AI_OBSERVATION, sequence: (session?.turns || []).length + 1 }),
      modelVersion: this.model
    };
  }
}

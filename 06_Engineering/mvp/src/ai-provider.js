import {
  CLAIM_TYPE,
  READINESS_ROUTE,
  SOURCE_TYPE,
  createClaim,
  createTurn
} from './domain.js';

/**
 * 真实模型接入只需要实现这五个方法。Core 不依赖具体供应商、Prompt 或 SDK。
 */
export class DreamOSAiProvider {
  async assessReadiness() { throw new Error('AI_PROVIDER_NOT_IMPLEMENTED'); }
  async startSession() { throw new Error('AI_PROVIDER_NOT_IMPLEMENTED'); }
  async continueSession() { throw new Error('AI_PROVIDER_NOT_IMPLEMENTED'); }
  async formulateUnderstanding() { throw new Error('AI_PROVIDER_NOT_IMPLEMENTED'); }
  async respondToSupplement() { throw new Error('AI_PROVIDER_NOT_IMPLEMENTED'); }
}

const sceneSignals = ['在', '房间', '家', '学校', '地库', '停车场', '路', '海', '车站', '电梯', '办公室'];
const actionSignals = ['找', '看', '走', '跑', '开', '等', '掉', '到不了', '离开', '错过', '追'];
const feelingSignals = ['着急', '害怕', '困惑', '安静', '开心', '难过', '生气', '感觉', '醒来'];
const bodySignals = ['头痛', '发烧', '疼痛', '药物', '喝醉', '酒精', '呼吸困难'];
const safetySignals = ['自杀', '自残', '伤害自己', '不想活', '现实危险'];

function includesAny(text, signals) {
  return signals.filter(signal => text.includes(signal));
}

export class MockAiProvider extends DreamOSAiProvider {
  constructor({ modelVersion = 'mock-0.1', maxQuestions = 3 } = {}) {
    super();
    this.modelVersion = modelVersion;
    this.maxQuestions = maxQuestions;
  }

  async assessReadiness({ dream, additions = [] } = {}) {
    const text = [dream?.raw?.text || '', ...additions.map(item => item.text || '')].join('\n').trim();
    const scenes = includesAny(text, sceneSignals);
    const actions = includesAny(text, actionSignals);
    const feelings = includesAny(text, feelingSignals);
    const body = includesAny(text, bodySignals);
    const safety = includesAny(text, safetySignals);
    const categories = Number(scenes.length > 0) + Number(actions.length > 0) + Number(feelings.length > 0);
    let route = READINESS_ROUTE.RECORD_FIRST;
    let reason = '当前只有零散材料，先完整保存，不形成心理假设。';
    if (safety.length) {
      route = READINESS_ROUTE.SAFETY_REVIEW;
      reason = '检测到可能涉及现实安全的内容，必须先进行安全确认。';
    } else if (body.length) {
      route = READINESS_ROUTE.BODY_CONTEXT_FIRST;
      reason = '身体、药物或环境因素可能是更直接的解释，先记录背景。';
    } else if (categories >= 2) {
      route = READINESS_ROUTE.ANALYSIS_READY;
      reason = '梦境同时包含场景、行动或感受中的至少两类可核对材料。';
    } else if (categories === 1) {
      route = READINESS_ROUTE.NEEDS_CLARIFICATION;
      reason = '已有一个可核对线索，再补充一小段感受或行动即可重新判断。';
    }
    return {
      schemaVersion: 'dream-os-ai-1.0',
      modelVersion: this.modelVersion,
      route,
      hardGateResults: {
        minimumMaterial: Boolean(text),
        safety: safety.length === 0,
        bodyContext: body.length === 0,
        userConsent: true
      },
      dimensions: {
        emotionalClarity: feelings.length ? 'MODERATE' : 'NONE',
        personalGrounding: additions.length ? 'MODERATE' : 'WEAK',
        wakingContinuity: 'UNKNOWN',
        repetition: 'UNKNOWN',
        narrativeStructure: scenes.length && actions.length ? 'MODERATE' : 'WEAK',
        alternativeControl: body.length ? 'WEAK' : 'MODERATE',
        userConsent: 'STRONG'
      },
      supportingEvidence: [...scenes, ...actions, ...feelings],
      missingInformation: categories < 2 ? ['梦中或醒来后的感受', '一个具体行动或阻碍'] : [],
      alternativeExplanations: body.length ? ['身体、药物或环境刺激'] : ['普通记忆重组或近期事件'],
      clarificationBudget: route === READINESS_ROUTE.NEEDS_CLARIFICATION ? 1 : 0,
      decisionReason: reason
    };
  }

  async startSession({ dream } = {}) {
    const text = dream?.raw?.text || '你记录下了一段梦的片段。';
    const content = `我先只确认梦里发生了什么：${text}\n\n回到这个画面时，哪种感受最接近你？`;
    return {
      turn: createTurn({
        speaker: 'AI',
        content,
        purpose: 'AFFECT',
        source: SOURCE_TYPE.AI_OBSERVATION,
        sequence: 1
      }),
      options: [
        { id: 'anxious', label: '着急', detail: '很想推进或离开，但总有事情挡住。' },
        { id: 'confused', label: '困惑', detail: '知道一些方向，却无法确认下一步。' },
        { id: 'blocked', label: '被卡住', detail: '目的地还在，但暂时找不到可用入口。' },
        { id: 'unclear', label: '说不清', detail: '记得画面，但还不能判断当时感受。' }
      ],
      modelVersion: this.modelVersion
    };
  }

  async continueSession({ session, userTurn } = {}) {
    const step = session.turns.filter(turn => turn.speaker === 'USER').length;
    const prompts = [
      '当你发现无法直接推进时，你更接近哪一种反应？可以说具体做了什么，也可以直接用自己的话回答。',
      '现实里最近有没有一件事，让你有过类似“知道方向，却推进不了”的体验？如果没有，也可以说没有。',
      '把刚才的回答和梦放在一起看，哪一部分最像你的真实感受？'
    ];
    const content = prompts[Math.min(step, prompts.length - 1)];
    return {
      turn: createTurn({
        speaker: 'AI',
        content,
        purpose: step === 0 ? 'CLARIFY' : step === 1 ? 'CONTEXT' : 'DISCONFIRM',
        source: SOURCE_TYPE.AI_OBSERVATION,
        sequence: session.turns.length + 1
      }),
      options: step === 0 ? [
        { id: 'try-another-way', label: '继续找另一条路', detail: '没有停下来，马上寻找其他入口或办法。' },
        { id: 'check-again', label: '反复确认', detail: '一直检查自己是否看错或遗漏了什么。' },
        { id: 'stop', label: '停在原地', detail: '知道目的地，却一时不知道下一步。' }
      ] : [],
      modelVersion: this.modelVersion,
      sourceTurnId: userTurn?.id || null
    };
  }

  async formulateUnderstanding({ dream, session } = {}) {
    const userText = session.turns.filter(turn => turn.speaker === 'USER').map(turn => turn.content).join('；');
    const rawText = dream?.raw?.text || '';
    const evidence = [
      { sourceType: SOURCE_TYPE.USER_TEXT, sourceId: dream.id, excerpt: rawText.slice(0, 160), relation: 'DIRECT_QUOTE' },
      ...(userText ? [{ sourceType: SOURCE_TYPE.USER_SELECTION, sourceId: session.id, excerpt: userText.slice(0, 160), relation: 'USER_ASSOCIATION' }] : [])
    ];
    const claims = [
      createClaim({ type: CLAIM_TYPE.OBSERVATION, text: '梦里出现了一个明确的目标或方向，同时存在阻碍。', evidence }),
      createClaim({ type: CLAIM_TYPE.HYPOTHESIS, text: '这段梦可能和近期“知道方向，却暂时推进不了”的体验有关。', evidence, alternativeExplanations: ['也可能只是近期记忆或环境刺激的重组'] }),
      createClaim({ type: CLAIM_TYPE.UNCERTAINTY, text: '目前还不能确定梦中的具体意象对你个人意味着什么。', evidence: [] })
    ];
    return {
      version: 1,
      claims,
      summary: '知道方向，却暂时推进不了。这个理解仍然可以继续修正。',
      modelVersion: this.modelVersion
    };
  }

  async respondToSupplement({ text } = {}) {
    return {
      turn: createTurn({
        speaker: 'AI',
        content: `我记下了“${String(text || '').slice(0, 80)}”。你可以继续补充；如果已经表达完整，可以重新整理这次理解。`,
        purpose: 'REFLECT',
        source: SOURCE_TYPE.AI_OBSERVATION,
        sequence: 1
      }),
      modelVersion: this.modelVersion
    };
  }
}

import {
  CLAIM_TYPE,
  DREAM_STATUS,
  FEEDBACK_STATUS,
  PERSONAL_UNDERSTANDING_STATUS,
  SESSION_STATE,
  SOURCE_TYPE,
  UNDERSTANDING_STATUS,
  appendUserAddition,
  clone,
  createClaim,
  createDreamDraft,
  createId,
  createPersonalUnderstanding,
  createSession,
  createTurn,
  createUnderstandingVersion,
  createUserState
} from './domain.js';
import {
  ENTRY_CHOICE,
  assertCanAddTurn,
  assertCanStartUnderstanding,
  assertCanSubmitFeedback,
  assertDreamCanArchive,
  nextUnderstandingStatus,
  transitionUnderstanding
} from './state-machine.js';
import { MemoryStore } from './store.js';

function titleFromText(text = '') {
  if (/B2|电梯|地下停车场/.test(text)) return '无法抵达的 B2';
  if (/湖|落水|车下沉/.test(text)) return '沉入湖中的车';
  if (/火车|雪/.test(text)) return '雪中的远途列车';
  if (/邮件|回复|回信/.test(text)) return '等待中的回复';
  const clean = text.replace(/\s+/g, '').replace(/[，。！？,.!?]/g, '');
  return clean ? clean.slice(0, 12) : '一段梦的片段';
}

export class DreamOSCore {
  constructor({ store = new MemoryStore(), aiProvider, clock = () => new Date().toISOString() } = {}) {
    if (!aiProvider) throw new Error('AI_PROVIDER_REQUIRED');
    this.store = store;
    this.ai = aiProvider;
    this.clock = clock;
  }

  async recordDream({ userId = 'local-user', rawText = '', inputType = SOURCE_TYPE.USER_TEXT, audio = null } = {}) {
    const dream = createDreamDraft({ userId, rawText, inputType, audio, capturedAt: this.clock() });
    await this.ensureUserState(userId);
    await this.store.put('dreams', dream.id, dream);
    await this.audit('DREAM_RECORDED', dream.id, { inputType });
    return clone(dream);
  }

  async archiveDream(dreamId, { title = null } = {}) {
    const dream = await this.requireDream(dreamId);
    assertDreamCanArchive(dream);
    const timestamp = this.clock();
    const readiness = await this.ai.assessReadiness({ dream, additions: dream.userAdditions });
    const archived = {
      ...dream,
      title: title?.trim() || titleFromText(dream.raw.text || ''),
      status: DREAM_STATUS.ARCHIVED,
      archivedAt: timestamp,
      analysisRoute: readiness.route,
      readinessAssessments: [...dream.readinessAssessments, { ...readiness, assessedAt: timestamp }],
      updatedAt: timestamp
    };
    await this.store.put('dreams', dreamId, archived);
    await this.audit('DREAM_ARCHIVED', dreamId, { route: readiness.route });
    return { dream: clone(archived), readiness: clone(readiness) };
  }

  async addDreamAddition(dreamId, { type, text } = {}) {
    const dream = await this.requireDream(dreamId);
    if (dream.status !== DREAM_STATUS.ARCHIVED) throw new Error('DREAM_MUST_BE_ARCHIVED');
    const updated = appendUserAddition(dream, { type, text, createdAt: this.clock() });
    const readiness = await this.ai.assessReadiness({ dream: updated, additions: updated.userAdditions });
    updated.analysisRoute = readiness.route;
    updated.readinessAssessments = [...updated.readinessAssessments, { ...readiness, assessedAt: this.clock() }];
    await this.store.put('dreams', dreamId, updated);
    await this.audit('DREAM_ADDITION_ADDED', dreamId, { type });
    return { dream: clone(updated), readiness: clone(readiness) };
  }

  async chooseUnderstanding(dreamId, choice) {
    const dream = await this.requireDream(dreamId);
    const readiness = dream.readinessAssessments.at(-1);
    assertCanStartUnderstanding(dream, readiness, choice);
    if (choice === ENTRY_CHOICE.LATER) return this.updateUnderstandingStatus(dream, UNDERSTANDING_STATUS.DEFERRED, 'UNDERSTANDING_DEFERRED');
    if (choice === ENTRY_CHOICE.RECORD_ONLY) return this.updateUnderstandingStatus(dream, UNDERSTANDING_STATUS.RECORD_ONLY, 'RECORD_ONLY_SELECTED');

    let session = dream.sessionId ? await this.store.get('sessions', dream.sessionId) : null;
    if (session) {
      if (session.state === SESSION_STATE.REVIEW) return { dream: clone(dream), session: clone(session), draft: await this.currentDraft(session.id) };
      if (session.state === SESSION_STATE.CONFIRMED) throw new Error('UNDERSTANDING_ALREADY_CONFIRMED');
    } else {
      session = createSession(dream.id, { startedAt: this.clock() });
      const first = await this.ai.startSession({ dream });
      session.turns.push({ ...first.turn, options: first.options || [] });
      await this.store.put('sessions', session.id, session);
    }
    const updatedDream = { ...dream, sessionId: session.id, understandingStatus: UNDERSTANDING_STATUS.IN_PROGRESS, updatedAt: this.clock() };
    await this.store.put('dreams', dream.id, updatedDream);
    await this.audit('UNDERSTANDING_STARTED', dream.id, { sessionId: session.id });
    return { dream: clone(updatedDream), session: clone(session) };
  }

  async sendSessionResponse(dreamId, { text, selectedOptionId = null } = {}) {
    const dream = await this.requireDream(dreamId);
    const session = await this.requireSession(dream);
    assertCanAddTurn(session);
    const value = String(text ?? '').trim();
    if (!value) throw new Error('TURN_CONTENT_REQUIRED');
    const userTurn = createTurn({
      speaker: 'USER',
      content: value,
      source: selectedOptionId ? SOURCE_TYPE.USER_SELECTION : SOURCE_TYPE.USER_TEXT,
      selectedOptionId,
      sequence: session.turns.length + 1,
      createdAt: this.clock()
    });
    session.turns.push(userTurn);
    session.questionBudget.used += 1;
    session.updatedAt = this.clock();
    let draft = null;
    if (session.questionBudget.used >= session.questionBudget.default) {
      transitionUnderstanding(session, SESSION_STATE.REVIEW);
      session.state = SESSION_STATE.REVIEW;
      session.completedAt = this.clock();
      const result = await this.ai.formulateUnderstanding({ dream, session });
      draft = createUnderstandingVersion({
        sessionId: session.id,
        version: 1,
        status: 'DRAFT',
        claims: result.claims,
        createdAt: this.clock()
      });
      draft.summary = result.summary;
      draft.modelVersion = result.modelVersion;
      session.understandingVersionIds.push(draft.id);
      await this.store.put('dreams', dream.id, { ...dream, understandingStatus: UNDERSTANDING_STATUS.REVIEW, updatedAt: this.clock() });
      await this.store.put('understanding', draft.id, draft);
    } else {
      const next = await this.ai.continueSession({ session, userTurn });
      session.turns.push({ ...next.turn, options: next.options || [] });
      await this.store.put('dreams', dream.id, { ...dream, understandingStatus: UNDERSTANDING_STATUS.IN_PROGRESS, updatedAt: this.clock() });
    }
    await this.store.put('sessions', session.id, session);
    await this.audit('SESSION_TURN_ADDED', dream.id, { sessionId: session.id, state: session.state });
    return { dream: await this.getDream(dream.id), session: clone(session), draft: clone(draft) };
  }

  async addSupplement(dreamId, text) {
    const dream = await this.requireDream(dreamId);
    const session = await this.requireSession(dream);
    if (session.state !== SESSION_STATE.REVIEW) throw new Error('SESSION_NOT_IN_REVIEW');
    const userTurn = createTurn({ speaker: 'USER', content: text, source: SOURCE_TYPE.USER_TEXT, purpose: 'SUPPLEMENT', sequence: session.turns.length + 1, createdAt: this.clock() });
    const response = await this.ai.respondToSupplement({ dream, session, text });
    session.turns.push(userTurn, { ...response.turn, options: [] });
    session.updatedAt = this.clock();
    await this.store.put('sessions', session.id, session);
    await this.audit('UNDERSTANDING_SUPPLEMENTED', dream.id, { sessionId: session.id });
    return { session: clone(session), draft: await this.currentDraft(session.id) };
  }

  async submitFeedback(dreamId, feedback = {}) {
    const dream = await this.requireDream(dreamId);
    const session = await this.requireSession(dream);
    assertCanSubmitFeedback(session, feedback);
    const draft = await this.currentDraft(session.id);
    const timestamp = this.clock();
    const record = {
      id: createId('feedback'),
      status: feedback.status,
      selectedClaimIds: [...(feedback.selectedClaimIds || [])],
      note: feedback.note?.trim() || null,
      createdAt: timestamp
    };
    const nextStatus = nextUnderstandingStatus(feedback.status);
    const claims = draft.claims.map(claim => ({
      ...claim,
      userConfirmed: feedback.status === FEEDBACK_STATUS.MATCHES || record.selectedClaimIds.includes(claim.id),
      eligibleForLongTerm: (feedback.status === FEEDBACK_STATUS.MATCHES || record.selectedClaimIds.includes(claim.id)) && claim.evidence.length >= 2 && claim.type !== CLAIM_TYPE.UNCERTAINTY
    }));
    if (nextStatus === UNDERSTANDING_STATUS.CONFIRMED && !claims.some(claim => claim.eligibleForLongTerm)) {
      throw new Error('CONFIRMATION_EVIDENCE_REQUIRED');
    }
    const version = { ...draft, claims, status: nextStatus === UNDERSTANDING_STATUS.CONFIRMED ? 'CURRENT' : 'REVIEWED', confirmedAt: nextStatus === UNDERSTANDING_STATUS.CONFIRMED ? timestamp : null };
    session.state = nextStatus === UNDERSTANDING_STATUS.CONFIRMED ? SESSION_STATE.CONFIRMED : nextStatus === UNDERSTANDING_STATUS.CLOSED_NO_INSIGHT ? SESSION_STATE.CLOSED_NO_INSIGHT : SESSION_STATE.REVIEW;
    session.updatedAt = timestamp;
    const updatedDream = {
      ...dream,
      understandingStatus: nextStatus,
      feedback: [...dream.feedback, record],
      understandingVersions: [...dream.understandingVersions, version],
      updatedAt: timestamp
    };
    let personalUnderstanding = null;
    await this.store.transaction(async () => {
      await this.store.put('understanding', version.id, version);
      await this.store.put('sessions', session.id, session);
      await this.store.put('dreams', dream.id, updatedDream);
      if (nextStatus === UNDERSTANDING_STATUS.CONFIRMED) {
        personalUnderstanding = await this.savePersonalUnderstanding({
          dream,
          session,
          version,
          claims,
          confirmedAt: timestamp
        });
      }
      await this.audit('UNDERSTANDING_FEEDBACK_SUBMITTED', dream.id, { status: feedback.status, sessionId: session.id });
    });
    return { dream: clone(updatedDream), session: clone(session), version: clone(version), feedback: clone(record), personalUnderstanding: clone(personalUnderstanding) };
  }

  async deleteDream(dreamId) {
    const dream = await this.requireDream(dreamId);
    const timestamp = this.clock();
    await this.store.transaction(async () => {
      await this.store.put('dreams', dreamId, { ...dream, status: DREAM_STATUS.DELETED, deletedAt: timestamp, updatedAt: timestamp });
      if (dream.sessionId) {
        await this.store.delete('sessions', dream.sessionId);
        const versions = await this.store.list('understanding', item => item.sessionId === dream.sessionId);
        for (const version of versions) await this.store.delete('understanding', version.id);
      }
      const personalUnderstandings = await this.store.list('personalUnderstanding', item => item.sourceDreamId === dreamId);
      for (const item of personalUnderstandings) await this.store.delete('personalUnderstanding', item.id);
      await this.rebuildUserState(dream.userId);
      await this.audit('DREAM_DELETED', dreamId, { deletedAt: timestamp });
    });
    return { id: dreamId, status: DREAM_STATUS.DELETED, deletedAt: timestamp };
  }

  async getDream(dreamId, { includeDeleted = false } = {}) {
    const dream = await this.store.get('dreams', dreamId);
    if (!dream || (!includeDeleted && dream.status === DREAM_STATUS.DELETED)) return null;
    return clone(dream);
  }

  async listDreams() {
    const dreams = await this.store.list('dreams', dream => dream.status !== DREAM_STATUS.DELETED);
    return dreams.sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
  }

  async getUserState(userId = 'local-user') {
    return this.store.get('users', userId);
  }

  async clearAllData() {
    await this.store.clear();
  }

  async listPersonalUnderstandings(userId = 'local-user') {
    const items = await this.store.list('personalUnderstanding', item => item.userId === userId);
    return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async getLatestPersonalUnderstanding(userId = 'local-user') {
    const user = await this.getUserState(userId);
    return user?.latestPersonalUnderstandingId
      ? this.store.get('personalUnderstanding', user.latestPersonalUnderstandingId)
      : null;
  }

  async getSession(dreamId) {
    const dream = await this.requireDream(dreamId);
    return dream.sessionId ? this.store.get('sessions', dream.sessionId) : null;
  }

  async currentDraft(sessionId) {
    const session = await this.store.get('sessions', sessionId);
    const id = session?.understandingVersionIds?.at(-1);
    return id ? this.store.get('understanding', id) : null;
  }

  async requireDream(dreamId) {
    const dream = await this.getDream(dreamId);
    if (!dream) throw new Error('DREAM_NOT_FOUND');
    return dream;
  }

  async requireSession(dream) {
    const session = dream.sessionId ? await this.store.get('sessions', dream.sessionId) : null;
    if (!session) throw new Error('SESSION_NOT_FOUND');
    return session;
  }

  async updateUnderstandingStatus(dream, status, auditAction) {
    const updated = { ...dream, understandingStatus: status, updatedAt: this.clock() };
    await this.store.put('dreams', dream.id, updated);
    await this.audit(auditAction, dream.id, { status });
    return { dream: clone(updated), session: dream.sessionId ? await this.store.get('sessions', dream.sessionId) : null };
  }

  async ensureUserState(userId = 'local-user', { nickname = 'toto' } = {}) {
    const existing = await this.store.get('users', userId);
    if (existing) return existing;
    const user = createUserState({ userId, nickname, createdAt: this.clock() });
    await this.store.put('users', userId, user);
    return user;
  }

  async savePersonalUnderstanding({ dream, session, version, claims, confirmedAt }) {
    const user = await this.ensureUserState(dream.userId);
    const previous = await this.store.list('personalUnderstanding', item => item.userId === dream.userId && item.status === PERSONAL_UNDERSTANDING_STATUS.CURRENT);
    for (const item of previous) {
      await this.store.put('personalUnderstanding', item.id, { ...item, status: PERSONAL_UNDERSTANDING_STATUS.SUPERSEDED, updatedAt: confirmedAt });
    }
    const confirmedClaims = claims.filter(claim => claim.userConfirmed && claim.eligibleForLongTerm);
    const personalUnderstanding = createPersonalUnderstanding({
      userId: dream.userId,
      sourceDreamId: dream.id,
      sourceSessionId: session.id,
      sourceUnderstandingVersionId: version.id,
      version: (user.personalUnderstandingIds?.length || 0) + 1,
      summary: version.summary,
      claims: confirmedClaims,
      createdAt: confirmedAt
    });
    await this.store.put('personalUnderstanding', personalUnderstanding.id, personalUnderstanding);
    const historyItem = {
      id: personalUnderstanding.id,
      sourceDreamId: dream.id,
      summary: personalUnderstanding.summary,
      createdAt: confirmedAt
    };
    const updatedUser = {
      ...user,
      latestPersonalUnderstandingId: personalUnderstanding.id,
      personalUnderstandingIds: [...(user.personalUnderstandingIds || []), personalUnderstanding.id],
      recentStatus: {
        summary: personalUnderstanding.summary,
        sourceDreamId: dream.id,
        personalUnderstandingId: personalUnderstanding.id,
        updatedAt: confirmedAt
      },
      history: [...(user.history || []), historyItem],
      updatedAt: confirmedAt
    };
    await this.store.put('users', user.id, updatedUser);
    return personalUnderstanding;
  }

  async rebuildUserState(userId = 'local-user') {
    const user = await this.store.get('users', userId);
    if (!user) return null;
    const all = await this.store.list('personalUnderstanding', item => item.userId === userId);
    const ordered = all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const latest = ordered.at(-1) || null;
    for (const item of ordered) {
      const status = item.id === latest?.id ? PERSONAL_UNDERSTANDING_STATUS.CURRENT : PERSONAL_UNDERSTANDING_STATUS.SUPERSEDED;
      if (item.status !== status) await this.store.put('personalUnderstanding', item.id, { ...item, status, updatedAt: this.clock() });
    }
    const updated = {
      ...user,
      latestPersonalUnderstandingId: latest?.id || null,
      personalUnderstandingIds: ordered.map(item => item.id),
      recentStatus: latest ? {
        summary: latest.summary,
        sourceDreamId: latest.sourceDreamId,
        personalUnderstandingId: latest.id,
        updatedAt: latest.updatedAt || latest.createdAt
      } : {
        summary: null,
        sourceDreamId: null,
        personalUnderstandingId: null,
        updatedAt: null
      },
      history: ordered.map(item => ({ id: item.id, sourceDreamId: item.sourceDreamId, summary: item.summary, createdAt: item.createdAt })),
      updatedAt: this.clock()
    };
    await this.store.put('users', userId, updated);
    return updated;
  }

  async audit(action, entityId, metadata = {}) {
    const id = createId('audit-event');
    await this.store.put('audit', id, { id, action, entityId, metadata, createdAt: this.clock() });
  }
}

export { ENTRY_CHOICE };

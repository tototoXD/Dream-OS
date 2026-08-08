export const SCHEMA_VERSION = 'dream-os-mvp-1.1';

export const DREAM_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED'
});

export const READINESS_ROUTE = Object.freeze({
  ANALYSIS_READY: 'ANALYSIS_READY',
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
  RECORD_FIRST: 'RECORD_FIRST',
  BODY_CONTEXT_FIRST: 'BODY_CONTEXT_FIRST',
  SAFETY_REVIEW: 'SAFETY_REVIEW'
});

export const UNDERSTANDING_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  DEFERRED: 'DEFERRED',
  RECORD_ONLY: 'RECORD_ONLY',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  CONFIRMED: 'CONFIRMED',
  PARTIAL: 'PARTIAL',
  CLOSED_NO_INSIGHT: 'CLOSED_NO_INSIGHT'
});

export const SESSION_STATE = Object.freeze({
  EXPLORING: 'EXPLORING',
  REVIEW: 'REVIEW',
  CONFIRMED: 'CONFIRMED',
  CLOSED_NO_INSIGHT: 'CLOSED_NO_INSIGHT'
});

export const FEEDBACK_STATUS = Object.freeze({
  MATCHES: 'MATCHES',
  PARTLY_MATCHES: 'PARTLY_MATCHES',
  DOES_NOT_MATCH: 'DOES_NOT_MATCH',
  UNSURE: 'UNSURE',
  USER_REWRITE: 'USER_REWRITE'
});

export const CLAIM_TYPE = Object.freeze({
  OBSERVATION: 'OBSERVATION',
  HYPOTHESIS: 'HYPOTHESIS',
  UNCERTAINTY: 'UNCERTAINTY',
  WATCH_ITEM: 'WATCH_ITEM'
});

export const SOURCE_TYPE = Object.freeze({
  USER_TEXT: 'USER_TEXT',
  USER_AUDIO: 'USER_AUDIO',
  USER_SELECTION: 'USER_SELECTION',
  USER_FEEDBACK: 'USER_FEEDBACK',
  AI_OBSERVATION: 'AI_OBSERVATION',
  HISTORICAL_RECORD: 'HISTORICAL_RECORD'
});

export const PERSONAL_UNDERSTANDING_STATUS = Object.freeze({
  CURRENT: 'CURRENT',
  SUPERSEDED: 'SUPERSEDED'
});

export function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createId(prefix = 'id', idFactory) {
  const factory = idFactory || (typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID.bind(globalThis.crypto) : null);
  if (typeof factory === 'function') return `${prefix}_${factory()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDreamDraft({
  userId = 'local-user',
  rawText = '',
  inputType = SOURCE_TYPE.USER_TEXT,
  audio = null,
  capturedAt = new Date().toISOString(),
  idFactory
} = {}) {
  const text = String(rawText ?? '').trim();
  if (!text && !audio) throw new Error('DREAM_CONTENT_REQUIRED');
  return {
    id: createId('dream', idFactory),
    schemaVersion: SCHEMA_VERSION,
    userId,
    title: null,
    raw: {
      text: text || null,
      audio: audio ? clone(audio) : null,
      inputType
    },
    capturedAt,
    archivedAt: null,
    status: DREAM_STATUS.DRAFT,
    analysisRoute: null,
    readinessAssessments: [],
    userAdditions: [],
    understandingStatus: UNDERSTANDING_STATUS.NOT_STARTED,
    sessionId: null,
    understandingVersions: [],
    feedback: [],
    deletedAt: null,
    createdAt: capturedAt,
    updatedAt: capturedAt
  };
}

export function createUserState({
  userId = 'local-user',
  nickname = 'toto',
  createdAt = new Date().toISOString()
} = {}) {
  return {
    id: userId,
    schemaVersion: SCHEMA_VERSION,
    userId,
    nickname: String(nickname || '').trim() || 'toto',
    recentStatus: {
      summary: null,
      sourceDreamId: null,
      personalUnderstandingId: null,
      updatedAt: null
    },
    latestPersonalUnderstandingId: null,
    personalUnderstandingIds: [],
    history: [],
    createdAt,
    updatedAt: createdAt
  };
}

export function appendUserAddition(dream, { type, text, createdAt = new Date().toISOString(), idFactory } = {}) {
  const value = String(text ?? '').trim();
  if (!value) throw new Error('ADDITION_CONTENT_REQUIRED');
  const next = clone(dream);
  next.userAdditions.push({
    id: createId('addition', idFactory),
    type: type || 'DREAM_DETAIL',
    text: value,
    createdAt,
    source: SOURCE_TYPE.USER_TEXT
  });
  next.updatedAt = createdAt;
  return next;
}

export function createSession(dreamId, { startedAt = new Date().toISOString(), idFactory } = {}) {
  return {
    id: createId('session', idFactory),
    schemaVersion: SCHEMA_VERSION,
    dreamId,
    state: SESSION_STATE.EXPLORING,
    focus: null,
    questionBudget: { default: 3, max: 5, used: 0 },
    turns: [],
    understandingVersionIds: [],
    startedAt,
    pausedAt: null,
    completedAt: null,
    updatedAt: startedAt
  };
}

export function createTurn({
  speaker,
  content,
  purpose = null,
  source = speaker === 'USER' ? SOURCE_TYPE.USER_TEXT : SOURCE_TYPE.AI_OBSERVATION,
  sequence,
  createdAt = new Date().toISOString(),
  selectedOptionId = null,
  citesHistory = []
} = {}) {
  const text = String(content ?? '').trim();
  if (!text) throw new Error('TURN_CONTENT_REQUIRED');
  return {
    id: createId('turn'),
    sequence,
    speaker,
    content: text,
    purpose,
    source,
    selectedOptionId,
    citesHistory: [...citesHistory],
    createdAt
  };
}

export function createUnderstandingVersion({
  sessionId,
  version = 1,
  status = 'DRAFT',
  claims = [],
  createdAt = new Date().toISOString(),
  idFactory
} = {}) {
  return {
    id: createId('understanding', idFactory),
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    version,
    status,
    claims: clone(claims),
    createdAt,
    confirmedAt: null
  };
}

export function createClaim({
  type = CLAIM_TYPE.OBSERVATION,
  text,
  evidence = [],
  alternativeExplanations = [],
  userConfirmed = false,
  idFactory
} = {}) {
  const value = String(text ?? '').trim();
  if (!value) throw new Error('CLAIM_CONTENT_REQUIRED');
  return {
    id: createId('claim', idFactory),
    type,
    text: value,
    evidence: clone(evidence),
    alternativeExplanations: [...alternativeExplanations],
    userConfirmed,
    eligibleForLongTerm: false
  };
}

export function createPersonalUnderstanding({
  userId = 'local-user',
  sourceDreamId,
  sourceSessionId,
  sourceUnderstandingVersionId,
  version = 1,
  summary,
  claims = [],
  createdAt = new Date().toISOString(),
  idFactory
} = {}) {
  if (!sourceDreamId) throw new Error('PERSONAL_UNDERSTANDING_DREAM_REQUIRED');
  if (!sourceSessionId) throw new Error('PERSONAL_UNDERSTANDING_SESSION_REQUIRED');
  if (!Array.isArray(claims) || claims.length === 0) throw new Error('PERSONAL_UNDERSTANDING_CLAIMS_REQUIRED');
  if (!claims.every(claim => claim?.userConfirmed && claim?.eligibleForLongTerm)) {
    throw new Error('PERSONAL_UNDERSTANDING_CLAIMS_NOT_CONFIRMED');
  }
  return {
    id: createId('personal-understanding', idFactory),
    schemaVersion: SCHEMA_VERSION,
    userId,
    sourceDreamId,
    sourceSessionId,
    sourceUnderstandingVersionId: sourceUnderstandingVersionId || null,
    version,
    status: PERSONAL_UNDERSTANDING_STATUS.CURRENT,
    summary: String(summary || '').trim() || null,
    claims: clone(claims),
    confirmedAt: createdAt,
    createdAt,
    updatedAt: createdAt
  };
}

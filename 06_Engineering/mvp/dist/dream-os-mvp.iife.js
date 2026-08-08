var DreamOSMvp = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    CLAIM_TYPE: () => CLAIM_TYPE,
    DREAM_STATUS: () => DREAM_STATUS,
    DreamOSAiProvider: () => DreamOSAiProvider,
    DreamOSCore: () => DreamOSCore,
    ENTRY_CHOICE: () => ENTRY_CHOICE,
    FEEDBACK_STATUS: () => FEEDBACK_STATUS,
    HttpAiProvider: () => HttpAiProvider,
    LocalStorageStore: () => LocalStorageStore,
    MemoryStore: () => MemoryStore,
    MockAiProvider: () => MockAiProvider,
    PERSONAL_UNDERSTANDING_STATUS: () => PERSONAL_UNDERSTANDING_STATUS,
    READINESS_ROUTE: () => READINESS_ROUTE,
    SCHEMA_VERSION: () => SCHEMA_VERSION,
    SESSION_STATE: () => SESSION_STATE,
    SOURCE_TYPE: () => SOURCE_TYPE,
    UNDERSTANDING_STATUS: () => UNDERSTANDING_STATUS,
    appendUserAddition: () => appendUserAddition,
    assertCanAddTurn: () => assertCanAddTurn,
    assertCanStartUnderstanding: () => assertCanStartUnderstanding,
    assertCanSubmitFeedback: () => assertCanSubmitFeedback,
    assertDreamCanArchive: () => assertDreamCanArchive,
    clone: () => clone,
    createClaim: () => createClaim,
    createDreamDraft: () => createDreamDraft,
    createId: () => createId,
    createPersonalUnderstanding: () => createPersonalUnderstanding,
    createSession: () => createSession,
    createTurn: () => createTurn,
    createUnderstandingVersion: () => createUnderstandingVersion,
    createUserState: () => createUserState,
    nextUnderstandingStatus: () => nextUnderstandingStatus,
    transitionUnderstanding: () => transitionUnderstanding
  });

  // src/domain.js
  var SCHEMA_VERSION = "dream-os-mvp-1.1";
  var DREAM_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED"
  });
  var READINESS_ROUTE = Object.freeze({
    ANALYSIS_READY: "ANALYSIS_READY",
    NEEDS_CLARIFICATION: "NEEDS_CLARIFICATION",
    RECORD_FIRST: "RECORD_FIRST",
    BODY_CONTEXT_FIRST: "BODY_CONTEXT_FIRST",
    SAFETY_REVIEW: "SAFETY_REVIEW"
  });
  var UNDERSTANDING_STATUS = Object.freeze({
    NOT_STARTED: "NOT_STARTED",
    DEFERRED: "DEFERRED",
    RECORD_ONLY: "RECORD_ONLY",
    IN_PROGRESS: "IN_PROGRESS",
    REVIEW: "REVIEW",
    CONFIRMED: "CONFIRMED",
    PARTIAL: "PARTIAL",
    CLOSED_NO_INSIGHT: "CLOSED_NO_INSIGHT"
  });
  var SESSION_STATE = Object.freeze({
    EXPLORING: "EXPLORING",
    REVIEW: "REVIEW",
    CONFIRMED: "CONFIRMED",
    CLOSED_NO_INSIGHT: "CLOSED_NO_INSIGHT"
  });
  var FEEDBACK_STATUS = Object.freeze({
    MATCHES: "MATCHES",
    PARTLY_MATCHES: "PARTLY_MATCHES",
    DOES_NOT_MATCH: "DOES_NOT_MATCH",
    UNSURE: "UNSURE",
    USER_REWRITE: "USER_REWRITE"
  });
  var CLAIM_TYPE = Object.freeze({
    OBSERVATION: "OBSERVATION",
    HYPOTHESIS: "HYPOTHESIS",
    UNCERTAINTY: "UNCERTAINTY",
    WATCH_ITEM: "WATCH_ITEM"
  });
  var SOURCE_TYPE = Object.freeze({
    USER_TEXT: "USER_TEXT",
    USER_AUDIO: "USER_AUDIO",
    USER_SELECTION: "USER_SELECTION",
    USER_FEEDBACK: "USER_FEEDBACK",
    AI_OBSERVATION: "AI_OBSERVATION",
    HISTORICAL_RECORD: "HISTORICAL_RECORD"
  });
  var PERSONAL_UNDERSTANDING_STATUS = Object.freeze({
    CURRENT: "CURRENT",
    SUPERSEDED: "SUPERSEDED"
  });
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function createId(prefix = "id", idFactory) {
    const factory = idFactory || (typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID.bind(globalThis.crypto) : null);
    if (typeof factory === "function") return `${prefix}_${factory()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  function createDreamDraft({
    userId = "local-user",
    rawText = "",
    inputType = SOURCE_TYPE.USER_TEXT,
    audio = null,
    capturedAt = (/* @__PURE__ */ new Date()).toISOString(),
    idFactory
  } = {}) {
    const text = String(rawText ?? "").trim();
    if (!text && !audio) throw new Error("DREAM_CONTENT_REQUIRED");
    return {
      id: createId("dream", idFactory),
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
  function createUserState({
    userId = "local-user",
    nickname = "toto",
    createdAt = (/* @__PURE__ */ new Date()).toISOString()
  } = {}) {
    return {
      id: userId,
      schemaVersion: SCHEMA_VERSION,
      userId,
      nickname: String(nickname || "").trim() || "toto",
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
  function appendUserAddition(dream, { type, text, createdAt = (/* @__PURE__ */ new Date()).toISOString(), idFactory } = {}) {
    const value = String(text ?? "").trim();
    if (!value) throw new Error("ADDITION_CONTENT_REQUIRED");
    const next = clone(dream);
    next.userAdditions.push({
      id: createId("addition", idFactory),
      type: type || "DREAM_DETAIL",
      text: value,
      createdAt,
      source: SOURCE_TYPE.USER_TEXT
    });
    next.updatedAt = createdAt;
    return next;
  }
  function createSession(dreamId, { startedAt = (/* @__PURE__ */ new Date()).toISOString(), idFactory } = {}) {
    return {
      id: createId("session", idFactory),
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
  function createTurn({
    speaker,
    content,
    purpose = null,
    source = speaker === "USER" ? SOURCE_TYPE.USER_TEXT : SOURCE_TYPE.AI_OBSERVATION,
    sequence,
    createdAt = (/* @__PURE__ */ new Date()).toISOString(),
    selectedOptionId = null,
    citesHistory = []
  } = {}) {
    const text = String(content ?? "").trim();
    if (!text) throw new Error("TURN_CONTENT_REQUIRED");
    return {
      id: createId("turn"),
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
  function createUnderstandingVersion({
    sessionId,
    version = 1,
    status = "DRAFT",
    claims = [],
    createdAt = (/* @__PURE__ */ new Date()).toISOString(),
    idFactory
  } = {}) {
    return {
      id: createId("understanding", idFactory),
      schemaVersion: SCHEMA_VERSION,
      sessionId,
      version,
      status,
      claims: clone(claims),
      createdAt,
      confirmedAt: null
    };
  }
  function createClaim({
    type = CLAIM_TYPE.OBSERVATION,
    text,
    evidence = [],
    alternativeExplanations = [],
    userConfirmed = false,
    idFactory
  } = {}) {
    const value = String(text ?? "").trim();
    if (!value) throw new Error("CLAIM_CONTENT_REQUIRED");
    return {
      id: createId("claim", idFactory),
      type,
      text: value,
      evidence: clone(evidence),
      alternativeExplanations: [...alternativeExplanations],
      userConfirmed,
      eligibleForLongTerm: false
    };
  }
  function createPersonalUnderstanding({
    userId = "local-user",
    sourceDreamId,
    sourceSessionId,
    sourceUnderstandingVersionId,
    version = 1,
    summary,
    claims = [],
    createdAt = (/* @__PURE__ */ new Date()).toISOString(),
    idFactory
  } = {}) {
    if (!sourceDreamId) throw new Error("PERSONAL_UNDERSTANDING_DREAM_REQUIRED");
    if (!sourceSessionId) throw new Error("PERSONAL_UNDERSTANDING_SESSION_REQUIRED");
    if (!Array.isArray(claims) || claims.length === 0) throw new Error("PERSONAL_UNDERSTANDING_CLAIMS_REQUIRED");
    if (!claims.every((claim) => claim?.userConfirmed && claim?.eligibleForLongTerm)) {
      throw new Error("PERSONAL_UNDERSTANDING_CLAIMS_NOT_CONFIRMED");
    }
    return {
      id: createId("personal-understanding", idFactory),
      schemaVersion: SCHEMA_VERSION,
      userId,
      sourceDreamId,
      sourceSessionId,
      sourceUnderstandingVersionId: sourceUnderstandingVersionId || null,
      version,
      status: PERSONAL_UNDERSTANDING_STATUS.CURRENT,
      summary: String(summary || "").trim() || null,
      claims: clone(claims),
      confirmedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    };
  }

  // src/state-machine.js
  var ENTRY_CHOICE = Object.freeze({
    NOW: "now",
    LATER: "later",
    RECORD_ONLY: "record-only"
  });
  var readinessToUnderstanding = /* @__PURE__ */ new Set([READINESS_ROUTE.ANALYSIS_READY]);
  function assertDreamCanArchive(dream) {
    if (!dream || dream.status === DREAM_STATUS.DELETED) throw new Error("DREAM_NOT_AVAILABLE");
    if (dream.status === DREAM_STATUS.ARCHIVED) return true;
    const hasText = Boolean(dream.raw?.text?.trim());
    const hasAudio = Boolean(dream.raw?.audio);
    if (!hasText && !hasAudio) throw new Error("DREAM_CONTENT_REQUIRED");
    return true;
  }
  function assertCanStartUnderstanding(dream, readiness, choice) {
    if (!dream || dream.status !== DREAM_STATUS.ARCHIVED) throw new Error("DREAM_MUST_BE_ARCHIVED");
    if (dream.understandingStatus === UNDERSTANDING_STATUS.CONFIRMED) throw new Error("UNDERSTANDING_ALREADY_CONFIRMED");
    if (choice === ENTRY_CHOICE.RECORD_ONLY || choice === ENTRY_CHOICE.LATER) return true;
    if (choice !== ENTRY_CHOICE.NOW) throw new Error("UNKNOWN_ENTRY_CHOICE");
    if (!readiness || !readinessToUnderstanding.has(readiness.route)) throw new Error("ANALYSIS_NOT_READY");
    return true;
  }
  function assertCanAddTurn(session) {
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.state !== SESSION_STATE.EXPLORING) throw new Error("SESSION_NOT_EXPLORING");
    if (session.questionBudget.used >= session.questionBudget.max) throw new Error("QUESTION_BUDGET_EXHAUSTED");
    return true;
  }
  function assertCanSubmitFeedback(session, feedback = {}) {
    if (!session || session.state !== SESSION_STATE.REVIEW) throw new Error("SESSION_NOT_IN_REVIEW");
    if (!Object.values(FEEDBACK_STATUS).includes(feedback.status)) throw new Error("UNKNOWN_FEEDBACK_STATUS");
    if (feedback.status === FEEDBACK_STATUS.PARTLY_MATCHES && (!Array.isArray(feedback.selectedClaimIds) || feedback.selectedClaimIds.length === 0)) {
      throw new Error("PARTIAL_FEEDBACK_REQUIRES_SELECTION");
    }
    return true;
  }
  function nextUnderstandingStatus(feedbackStatus) {
    switch (feedbackStatus) {
      case FEEDBACK_STATUS.MATCHES:
        return UNDERSTANDING_STATUS.CONFIRMED;
      case FEEDBACK_STATUS.PARTLY_MATCHES:
        return UNDERSTANDING_STATUS.PARTIAL;
      case FEEDBACK_STATUS.DOES_NOT_MATCH:
      case FEEDBACK_STATUS.UNSURE:
      case FEEDBACK_STATUS.USER_REWRITE:
        return UNDERSTANDING_STATUS.CLOSED_NO_INSIGHT;
      default:
        throw new Error("UNKNOWN_FEEDBACK_STATUS");
    }
  }
  function transitionUnderstanding(session, targetState) {
    const allowed = {
      [SESSION_STATE.EXPLORING]: /* @__PURE__ */ new Set([SESSION_STATE.REVIEW]),
      [SESSION_STATE.REVIEW]: /* @__PURE__ */ new Set([SESSION_STATE.REVIEW, SESSION_STATE.CONFIRMED, SESSION_STATE.CLOSED_NO_INSIGHT]),
      [SESSION_STATE.CONFIRMED]: /* @__PURE__ */ new Set(),
      [SESSION_STATE.CLOSED_NO_INSIGHT]: /* @__PURE__ */ new Set()
    };
    if (!allowed[session.state]?.has(targetState)) throw new Error(`INVALID_SESSION_TRANSITION:${session.state}->${targetState}`);
    return targetState;
  }

  // src/ai-provider.js
  var DreamOSAiProvider = class {
    async assessReadiness() {
      throw new Error("AI_PROVIDER_NOT_IMPLEMENTED");
    }
    async startSession() {
      throw new Error("AI_PROVIDER_NOT_IMPLEMENTED");
    }
    async continueSession() {
      throw new Error("AI_PROVIDER_NOT_IMPLEMENTED");
    }
    async formulateUnderstanding() {
      throw new Error("AI_PROVIDER_NOT_IMPLEMENTED");
    }
    async respondToSupplement() {
      throw new Error("AI_PROVIDER_NOT_IMPLEMENTED");
    }
  };
  var sceneSignals = ["\u5728", "\u623F\u95F4", "\u5BB6", "\u5B66\u6821", "\u5730\u5E93", "\u505C\u8F66\u573A", "\u8DEF", "\u6D77", "\u8F66\u7AD9", "\u7535\u68AF", "\u529E\u516C\u5BA4"];
  var actionSignals = ["\u627E", "\u770B", "\u8D70", "\u8DD1", "\u5F00", "\u7B49", "\u6389", "\u5230\u4E0D\u4E86", "\u79BB\u5F00", "\u9519\u8FC7", "\u8FFD"];
  var feelingSignals = ["\u7740\u6025", "\u5BB3\u6015", "\u56F0\u60D1", "\u5B89\u9759", "\u5F00\u5FC3", "\u96BE\u8FC7", "\u751F\u6C14", "\u611F\u89C9", "\u9192\u6765"];
  var bodySignals = ["\u5934\u75DB", "\u53D1\u70E7", "\u75BC\u75DB", "\u836F\u7269", "\u559D\u9189", "\u9152\u7CBE", "\u547C\u5438\u56F0\u96BE"];
  var safetySignals = ["\u81EA\u6740", "\u81EA\u6B8B", "\u4F24\u5BB3\u81EA\u5DF1", "\u4E0D\u60F3\u6D3B", "\u73B0\u5B9E\u5371\u9669"];
  function includesAny(text, signals) {
    return signals.filter((signal) => text.includes(signal));
  }
  var MockAiProvider = class extends DreamOSAiProvider {
    constructor({ modelVersion = "mock-0.1", maxQuestions = 3 } = {}) {
      super();
      this.modelVersion = modelVersion;
      this.maxQuestions = maxQuestions;
    }
    async assessReadiness({ dream, additions = [] } = {}) {
      const text = [dream?.raw?.text || "", ...additions.map((item) => item.text || "")].join("\n").trim();
      const scenes = includesAny(text, sceneSignals);
      const actions = includesAny(text, actionSignals);
      const feelings = includesAny(text, feelingSignals);
      const body = includesAny(text, bodySignals);
      const safety = includesAny(text, safetySignals);
      const categories = Number(scenes.length > 0) + Number(actions.length > 0) + Number(feelings.length > 0);
      let route = READINESS_ROUTE.RECORD_FIRST;
      let reason = "\u5F53\u524D\u53EA\u6709\u96F6\u6563\u6750\u6599\uFF0C\u5148\u5B8C\u6574\u4FDD\u5B58\uFF0C\u4E0D\u5F62\u6210\u5FC3\u7406\u5047\u8BBE\u3002";
      if (safety.length) {
        route = READINESS_ROUTE.SAFETY_REVIEW;
        reason = "\u68C0\u6D4B\u5230\u53EF\u80FD\u6D89\u53CA\u73B0\u5B9E\u5B89\u5168\u7684\u5185\u5BB9\uFF0C\u5FC5\u987B\u5148\u8FDB\u884C\u5B89\u5168\u786E\u8BA4\u3002";
      } else if (body.length) {
        route = READINESS_ROUTE.BODY_CONTEXT_FIRST;
        reason = "\u8EAB\u4F53\u3001\u836F\u7269\u6216\u73AF\u5883\u56E0\u7D20\u53EF\u80FD\u662F\u66F4\u76F4\u63A5\u7684\u89E3\u91CA\uFF0C\u5148\u8BB0\u5F55\u80CC\u666F\u3002";
      } else if (categories >= 2) {
        route = READINESS_ROUTE.ANALYSIS_READY;
        reason = "\u68A6\u5883\u540C\u65F6\u5305\u542B\u573A\u666F\u3001\u884C\u52A8\u6216\u611F\u53D7\u4E2D\u7684\u81F3\u5C11\u4E24\u7C7B\u53EF\u6838\u5BF9\u6750\u6599\u3002";
      } else if (categories === 1) {
        route = READINESS_ROUTE.NEEDS_CLARIFICATION;
        reason = "\u5DF2\u6709\u4E00\u4E2A\u53EF\u6838\u5BF9\u7EBF\u7D22\uFF0C\u518D\u8865\u5145\u4E00\u5C0F\u6BB5\u611F\u53D7\u6216\u884C\u52A8\u5373\u53EF\u91CD\u65B0\u5224\u65AD\u3002";
      }
      return {
        schemaVersion: "dream-os-ai-1.0",
        modelVersion: this.modelVersion,
        route,
        hardGateResults: {
          minimumMaterial: Boolean(text),
          safety: safety.length === 0,
          bodyContext: body.length === 0,
          userConsent: true
        },
        dimensions: {
          emotionalClarity: feelings.length ? "MODERATE" : "NONE",
          personalGrounding: additions.length ? "MODERATE" : "WEAK",
          wakingContinuity: "UNKNOWN",
          repetition: "UNKNOWN",
          narrativeStructure: scenes.length && actions.length ? "MODERATE" : "WEAK",
          alternativeControl: body.length ? "WEAK" : "MODERATE",
          userConsent: "STRONG"
        },
        supportingEvidence: [...scenes, ...actions, ...feelings],
        missingInformation: categories < 2 ? ["\u68A6\u4E2D\u6216\u9192\u6765\u540E\u7684\u611F\u53D7", "\u4E00\u4E2A\u5177\u4F53\u884C\u52A8\u6216\u963B\u788D"] : [],
        alternativeExplanations: body.length ? ["\u8EAB\u4F53\u3001\u836F\u7269\u6216\u73AF\u5883\u523A\u6FC0"] : ["\u666E\u901A\u8BB0\u5FC6\u91CD\u7EC4\u6216\u8FD1\u671F\u4E8B\u4EF6"],
        clarificationBudget: route === READINESS_ROUTE.NEEDS_CLARIFICATION ? 1 : 0,
        decisionReason: reason
      };
    }
    async startSession({ dream } = {}) {
      const text = dream?.raw?.text || "\u4F60\u8BB0\u5F55\u4E0B\u4E86\u4E00\u6BB5\u68A6\u7684\u7247\u6BB5\u3002";
      const content = `\u6211\u5148\u53EA\u786E\u8BA4\u68A6\u91CC\u53D1\u751F\u4E86\u4EC0\u4E48\uFF1A${text}

\u56DE\u5230\u8FD9\u4E2A\u753B\u9762\u65F6\uFF0C\u54EA\u79CD\u611F\u53D7\u6700\u63A5\u8FD1\u4F60\uFF1F`;
      return {
        turn: createTurn({
          speaker: "AI",
          content,
          purpose: "AFFECT",
          source: SOURCE_TYPE.AI_OBSERVATION,
          sequence: 1
        }),
        options: [
          { id: "anxious", label: "\u7740\u6025", detail: "\u5F88\u60F3\u63A8\u8FDB\u6216\u79BB\u5F00\uFF0C\u4F46\u603B\u6709\u4E8B\u60C5\u6321\u4F4F\u3002" },
          { id: "confused", label: "\u56F0\u60D1", detail: "\u77E5\u9053\u4E00\u4E9B\u65B9\u5411\uFF0C\u5374\u65E0\u6CD5\u786E\u8BA4\u4E0B\u4E00\u6B65\u3002" },
          { id: "blocked", label: "\u88AB\u5361\u4F4F", detail: "\u76EE\u7684\u5730\u8FD8\u5728\uFF0C\u4F46\u6682\u65F6\u627E\u4E0D\u5230\u53EF\u7528\u5165\u53E3\u3002" },
          { id: "unclear", label: "\u8BF4\u4E0D\u6E05", detail: "\u8BB0\u5F97\u753B\u9762\uFF0C\u4F46\u8FD8\u4E0D\u80FD\u5224\u65AD\u5F53\u65F6\u611F\u53D7\u3002" }
        ],
        modelVersion: this.modelVersion
      };
    }
    async continueSession({ session, userTurn } = {}) {
      const step = session.turns.filter((turn) => turn.speaker === "USER").length;
      const prompts = [
        "\u5F53\u4F60\u53D1\u73B0\u65E0\u6CD5\u76F4\u63A5\u63A8\u8FDB\u65F6\uFF0C\u4F60\u66F4\u63A5\u8FD1\u54EA\u4E00\u79CD\u53CD\u5E94\uFF1F\u53EF\u4EE5\u8BF4\u5177\u4F53\u505A\u4E86\u4EC0\u4E48\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u7528\u81EA\u5DF1\u7684\u8BDD\u56DE\u7B54\u3002",
        "\u73B0\u5B9E\u91CC\u6700\u8FD1\u6709\u6CA1\u6709\u4E00\u4EF6\u4E8B\uFF0C\u8BA9\u4F60\u6709\u8FC7\u7C7B\u4F3C\u201C\u77E5\u9053\u65B9\u5411\uFF0C\u5374\u63A8\u8FDB\u4E0D\u4E86\u201D\u7684\u4F53\u9A8C\uFF1F\u5982\u679C\u6CA1\u6709\uFF0C\u4E5F\u53EF\u4EE5\u8BF4\u6CA1\u6709\u3002",
        "\u628A\u521A\u624D\u7684\u56DE\u7B54\u548C\u68A6\u653E\u5728\u4E00\u8D77\u770B\uFF0C\u54EA\u4E00\u90E8\u5206\u6700\u50CF\u4F60\u7684\u771F\u5B9E\u611F\u53D7\uFF1F"
      ];
      const content = prompts[Math.min(step, prompts.length - 1)];
      return {
        turn: createTurn({
          speaker: "AI",
          content,
          purpose: step === 0 ? "CLARIFY" : step === 1 ? "CONTEXT" : "DISCONFIRM",
          source: SOURCE_TYPE.AI_OBSERVATION,
          sequence: session.turns.length + 1
        }),
        options: step === 0 ? [
          { id: "try-another-way", label: "\u7EE7\u7EED\u627E\u53E6\u4E00\u6761\u8DEF", detail: "\u6CA1\u6709\u505C\u4E0B\u6765\uFF0C\u9A6C\u4E0A\u5BFB\u627E\u5176\u4ED6\u5165\u53E3\u6216\u529E\u6CD5\u3002" },
          { id: "check-again", label: "\u53CD\u590D\u786E\u8BA4", detail: "\u4E00\u76F4\u68C0\u67E5\u81EA\u5DF1\u662F\u5426\u770B\u9519\u6216\u9057\u6F0F\u4E86\u4EC0\u4E48\u3002" },
          { id: "stop", label: "\u505C\u5728\u539F\u5730", detail: "\u77E5\u9053\u76EE\u7684\u5730\uFF0C\u5374\u4E00\u65F6\u4E0D\u77E5\u9053\u4E0B\u4E00\u6B65\u3002" }
        ] : [],
        modelVersion: this.modelVersion,
        sourceTurnId: userTurn?.id || null
      };
    }
    async formulateUnderstanding({ dream, session } = {}) {
      const userText = session.turns.filter((turn) => turn.speaker === "USER").map((turn) => turn.content).join("\uFF1B");
      const rawText = dream?.raw?.text || "";
      const evidence = [
        { sourceType: SOURCE_TYPE.USER_TEXT, sourceId: dream.id, excerpt: rawText.slice(0, 160), relation: "DIRECT_QUOTE" },
        ...userText ? [{ sourceType: SOURCE_TYPE.USER_SELECTION, sourceId: session.id, excerpt: userText.slice(0, 160), relation: "USER_ASSOCIATION" }] : []
      ];
      const claims = [
        createClaim({ type: CLAIM_TYPE.OBSERVATION, text: "\u68A6\u91CC\u51FA\u73B0\u4E86\u4E00\u4E2A\u660E\u786E\u7684\u76EE\u6807\u6216\u65B9\u5411\uFF0C\u540C\u65F6\u5B58\u5728\u963B\u788D\u3002", evidence }),
        createClaim({ type: CLAIM_TYPE.HYPOTHESIS, text: "\u8FD9\u6BB5\u68A6\u53EF\u80FD\u548C\u8FD1\u671F\u201C\u77E5\u9053\u65B9\u5411\uFF0C\u5374\u6682\u65F6\u63A8\u8FDB\u4E0D\u4E86\u201D\u7684\u4F53\u9A8C\u6709\u5173\u3002", evidence, alternativeExplanations: ["\u4E5F\u53EF\u80FD\u53EA\u662F\u8FD1\u671F\u8BB0\u5FC6\u6216\u73AF\u5883\u523A\u6FC0\u7684\u91CD\u7EC4"] }),
        createClaim({ type: CLAIM_TYPE.UNCERTAINTY, text: "\u76EE\u524D\u8FD8\u4E0D\u80FD\u786E\u5B9A\u68A6\u4E2D\u7684\u5177\u4F53\u610F\u8C61\u5BF9\u4F60\u4E2A\u4EBA\u610F\u5473\u7740\u4EC0\u4E48\u3002", evidence: [] })
      ];
      return {
        version: 1,
        claims,
        summary: "\u77E5\u9053\u65B9\u5411\uFF0C\u5374\u6682\u65F6\u63A8\u8FDB\u4E0D\u4E86\u3002\u8FD9\u4E2A\u7406\u89E3\u4ECD\u7136\u53EF\u4EE5\u7EE7\u7EED\u4FEE\u6B63\u3002",
        modelVersion: this.modelVersion
      };
    }
    async respondToSupplement({ text } = {}) {
      return {
        turn: createTurn({
          speaker: "AI",
          content: `\u6211\u8BB0\u4E0B\u4E86\u201C${String(text || "").slice(0, 80)}\u201D\u3002\u4F60\u53EF\u4EE5\u7EE7\u7EED\u8865\u5145\uFF1B\u5982\u679C\u5DF2\u7ECF\u8868\u8FBE\u5B8C\u6574\uFF0C\u53EF\u4EE5\u91CD\u65B0\u6574\u7406\u8FD9\u6B21\u7406\u89E3\u3002`,
          purpose: "REFLECT",
          source: SOURCE_TYPE.AI_OBSERVATION,
          sequence: 1
        }),
        modelVersion: this.modelVersion
      };
    }
  };

  // src/http-ai-provider.js
  var HttpAiProvider = class extends DreamOSAiProvider {
    constructor({ baseUrl = "/api" } = {}) {
      super();
      this.baseUrl = String(baseUrl).replace(/\/$/, "");
    }
    async call(operation, payload) {
      const response = await fetch(`${this.baseUrl}/ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation, payload })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `AI_API_${response.status}`);
      return data;
    }
    assessReadiness(payload) {
      return this.call("assessReadiness", payload);
    }
    startSession(payload) {
      return this.call("startSession", payload);
    }
    continueSession(payload) {
      return this.call("continueSession", payload);
    }
    formulateUnderstanding(payload) {
      return this.call("formulateUnderstanding", payload);
    }
    respondToSupplement(payload) {
      return this.call("respondToSupplement", payload);
    }
  };

  // src/store.js
  var COLLECTIONS = ["dreams", "sessions", "understanding", "personalUnderstanding", "users", "audit"];
  function emptyState() {
    return { dreams: {}, sessions: {}, understanding: {}, personalUnderstanding: {}, users: {}, audit: [] };
  }
  var MemoryStore = class {
    constructor(seed = {}) {
      seed = seed && typeof seed === "object" ? seed : {};
      this.state = {
        ...emptyState(),
        ...clone(seed),
        dreams: { ...seed.dreams || {} },
        sessions: { ...seed.sessions || {} },
        understanding: { ...seed.understanding || {} },
        personalUnderstanding: { ...seed.personalUnderstanding || {} },
        users: { ...seed.users || {} },
        audit: [...seed.audit || []]
      };
    }
    async get(collection, id) {
      this.assertCollection(collection);
      const value = collection === "audit" ? this.state.audit.find((event) => event.id === id) : this.state[collection][id];
      return clone(value) ?? null;
    }
    async put(collection, id, value) {
      this.assertCollection(collection);
      if (collection === "audit") this.state.audit.push(clone(value));
      else this.state[collection][id] = clone(value);
      return clone(value);
    }
    async delete(collection, id) {
      this.assertCollection(collection);
      if (collection === "audit") this.state.audit = this.state.audit.filter((event) => event.id !== id);
      else delete this.state[collection][id];
    }
    async list(collection, predicate = () => true) {
      this.assertCollection(collection);
      const values = collection === "audit" ? this.state.audit : Object.values(this.state[collection]);
      return clone(values.filter(predicate));
    }
    async transaction(work) {
      const before = clone(this.state);
      try {
        return await work(this);
      } catch (error) {
        this.state = before;
        throw error;
      }
    }
    snapshot() {
      return clone(this.state);
    }
    async clear() {
      this.state = emptyState();
    }
    assertCollection(collection) {
      if (!COLLECTIONS.includes(collection)) throw new Error(`UNKNOWN_COLLECTION:${collection}`);
    }
  };
  var LocalStorageStore = class extends MemoryStore {
    constructor(storage, key = "dream-os-mvp-state-v1") {
      if (!storage?.getItem || !storage?.setItem) throw new Error("LOCAL_STORAGE_REQUIRED");
      let seed = emptyState();
      try {
        seed = JSON.parse(storage.getItem(key) || JSON.stringify(seed));
      } catch {
        seed = emptyState();
      }
      super(seed);
      this.storage = storage;
      this.key = key;
    }
    persist() {
      this.storage.setItem(this.key, JSON.stringify(this.state));
    }
    async put(collection, id, value) {
      const result = await super.put(collection, id, value);
      this.persist();
      return result;
    }
    async delete(collection, id) {
      await super.delete(collection, id);
      this.persist();
    }
    async clear() {
      await super.clear();
      this.persist();
    }
    async transaction(work) {
      try {
        const result = await super.transaction(work);
        this.persist();
        return result;
      } catch (error) {
        this.persist();
        throw error;
      }
    }
  };

  // src/core.js
  function titleFromText(text = "") {
    if (/B2|电梯|地下停车场/.test(text)) return "\u65E0\u6CD5\u62B5\u8FBE\u7684 B2";
    if (/湖|落水|车下沉/.test(text)) return "\u6C89\u5165\u6E56\u4E2D\u7684\u8F66";
    if (/火车|雪/.test(text)) return "\u96EA\u4E2D\u7684\u8FDC\u9014\u5217\u8F66";
    if (/邮件|回复|回信/.test(text)) return "\u7B49\u5F85\u4E2D\u7684\u56DE\u590D";
    const clean = text.replace(/\s+/g, "").replace(/[，。！？,.!?]/g, "");
    return clean ? clean.slice(0, 12) : "\u4E00\u6BB5\u68A6\u7684\u7247\u6BB5";
  }
  var DreamOSCore = class {
    constructor({ store = new MemoryStore(), aiProvider, clock = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
      if (!aiProvider) throw new Error("AI_PROVIDER_REQUIRED");
      this.store = store;
      this.ai = aiProvider;
      this.clock = clock;
    }
    async recordDream({ userId = "local-user", rawText = "", inputType = SOURCE_TYPE.USER_TEXT, audio = null } = {}) {
      const dream = createDreamDraft({ userId, rawText, inputType, audio, capturedAt: this.clock() });
      await this.ensureUserState(userId);
      await this.store.put("dreams", dream.id, dream);
      await this.audit("DREAM_RECORDED", dream.id, { inputType });
      return clone(dream);
    }
    async archiveDream(dreamId, { title = null } = {}) {
      const dream = await this.requireDream(dreamId);
      assertDreamCanArchive(dream);
      const timestamp = this.clock();
      const readiness = await this.ai.assessReadiness({ dream, additions: dream.userAdditions });
      const archived = {
        ...dream,
        title: title?.trim() || titleFromText(dream.raw.text || ""),
        status: DREAM_STATUS.ARCHIVED,
        archivedAt: timestamp,
        analysisRoute: readiness.route,
        readinessAssessments: [...dream.readinessAssessments, { ...readiness, assessedAt: timestamp }],
        updatedAt: timestamp
      };
      await this.store.put("dreams", dreamId, archived);
      await this.audit("DREAM_ARCHIVED", dreamId, { route: readiness.route });
      return { dream: clone(archived), readiness: clone(readiness) };
    }
    async addDreamAddition(dreamId, { type, text } = {}) {
      const dream = await this.requireDream(dreamId);
      if (dream.status !== DREAM_STATUS.ARCHIVED) throw new Error("DREAM_MUST_BE_ARCHIVED");
      const updated = appendUserAddition(dream, { type, text, createdAt: this.clock() });
      const readiness = await this.ai.assessReadiness({ dream: updated, additions: updated.userAdditions });
      updated.analysisRoute = readiness.route;
      updated.readinessAssessments = [...updated.readinessAssessments, { ...readiness, assessedAt: this.clock() }];
      await this.store.put("dreams", dreamId, updated);
      await this.audit("DREAM_ADDITION_ADDED", dreamId, { type });
      return { dream: clone(updated), readiness: clone(readiness) };
    }
    async chooseUnderstanding(dreamId, choice) {
      const dream = await this.requireDream(dreamId);
      const readiness = dream.readinessAssessments.at(-1);
      assertCanStartUnderstanding(dream, readiness, choice);
      if (choice === ENTRY_CHOICE.LATER) return this.updateUnderstandingStatus(dream, UNDERSTANDING_STATUS.DEFERRED, "UNDERSTANDING_DEFERRED");
      if (choice === ENTRY_CHOICE.RECORD_ONLY) return this.updateUnderstandingStatus(dream, UNDERSTANDING_STATUS.RECORD_ONLY, "RECORD_ONLY_SELECTED");
      let session = dream.sessionId ? await this.store.get("sessions", dream.sessionId) : null;
      if (session) {
        if (session.state === SESSION_STATE.REVIEW) return { dream: clone(dream), session: clone(session), draft: await this.currentDraft(session.id) };
        if (session.state === SESSION_STATE.CONFIRMED) throw new Error("UNDERSTANDING_ALREADY_CONFIRMED");
      } else {
        session = createSession(dream.id, { startedAt: this.clock() });
        const first = await this.ai.startSession({ dream });
        session.turns.push({ ...first.turn, options: first.options || [] });
        await this.store.put("sessions", session.id, session);
      }
      const updatedDream = { ...dream, sessionId: session.id, understandingStatus: UNDERSTANDING_STATUS.IN_PROGRESS, updatedAt: this.clock() };
      await this.store.put("dreams", dream.id, updatedDream);
      await this.audit("UNDERSTANDING_STARTED", dream.id, { sessionId: session.id });
      return { dream: clone(updatedDream), session: clone(session) };
    }
    async sendSessionResponse(dreamId, { text, selectedOptionId = null } = {}) {
      const dream = await this.requireDream(dreamId);
      const session = await this.requireSession(dream);
      assertCanAddTurn(session);
      const value = String(text ?? "").trim();
      if (!value) throw new Error("TURN_CONTENT_REQUIRED");
      const userTurn = createTurn({
        speaker: "USER",
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
          status: "DRAFT",
          claims: result.claims,
          createdAt: this.clock()
        });
        draft.summary = result.summary;
        draft.modelVersion = result.modelVersion;
        session.understandingVersionIds.push(draft.id);
        await this.store.put("dreams", dream.id, { ...dream, understandingStatus: UNDERSTANDING_STATUS.REVIEW, updatedAt: this.clock() });
        await this.store.put("understanding", draft.id, draft);
      } else {
        const next = await this.ai.continueSession({ session, userTurn });
        session.turns.push({ ...next.turn, options: next.options || [] });
        await this.store.put("dreams", dream.id, { ...dream, understandingStatus: UNDERSTANDING_STATUS.IN_PROGRESS, updatedAt: this.clock() });
      }
      await this.store.put("sessions", session.id, session);
      await this.audit("SESSION_TURN_ADDED", dream.id, { sessionId: session.id, state: session.state });
      return { dream: await this.getDream(dream.id), session: clone(session), draft: clone(draft) };
    }
    async addSupplement(dreamId, text) {
      const dream = await this.requireDream(dreamId);
      const session = await this.requireSession(dream);
      if (session.state !== SESSION_STATE.REVIEW) throw new Error("SESSION_NOT_IN_REVIEW");
      const userTurn = createTurn({ speaker: "USER", content: text, source: SOURCE_TYPE.USER_TEXT, purpose: "SUPPLEMENT", sequence: session.turns.length + 1, createdAt: this.clock() });
      const response = await this.ai.respondToSupplement({ dream, session, text });
      session.turns.push(userTurn, { ...response.turn, options: [] });
      session.updatedAt = this.clock();
      await this.store.put("sessions", session.id, session);
      await this.audit("UNDERSTANDING_SUPPLEMENTED", dream.id, { sessionId: session.id });
      return { session: clone(session), draft: await this.currentDraft(session.id) };
    }
    async submitFeedback(dreamId, feedback = {}) {
      const dream = await this.requireDream(dreamId);
      const session = await this.requireSession(dream);
      assertCanSubmitFeedback(session, feedback);
      const draft = await this.currentDraft(session.id);
      const timestamp = this.clock();
      const record = {
        id: createId("feedback"),
        status: feedback.status,
        selectedClaimIds: [...feedback.selectedClaimIds || []],
        note: feedback.note?.trim() || null,
        createdAt: timestamp
      };
      const nextStatus = nextUnderstandingStatus(feedback.status);
      const claims = draft.claims.map((claim) => ({
        ...claim,
        userConfirmed: feedback.status === FEEDBACK_STATUS.MATCHES || record.selectedClaimIds.includes(claim.id),
        eligibleForLongTerm: (feedback.status === FEEDBACK_STATUS.MATCHES || record.selectedClaimIds.includes(claim.id)) && claim.evidence.length >= 2 && claim.type !== CLAIM_TYPE.UNCERTAINTY
      }));
      if (nextStatus === UNDERSTANDING_STATUS.CONFIRMED && !claims.some((claim) => claim.eligibleForLongTerm)) {
        throw new Error("CONFIRMATION_EVIDENCE_REQUIRED");
      }
      const version = { ...draft, claims, status: nextStatus === UNDERSTANDING_STATUS.CONFIRMED ? "CURRENT" : "REVIEWED", confirmedAt: nextStatus === UNDERSTANDING_STATUS.CONFIRMED ? timestamp : null };
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
        await this.store.put("understanding", version.id, version);
        await this.store.put("sessions", session.id, session);
        await this.store.put("dreams", dream.id, updatedDream);
        if (nextStatus === UNDERSTANDING_STATUS.CONFIRMED) {
          personalUnderstanding = await this.savePersonalUnderstanding({
            dream,
            session,
            version,
            claims,
            confirmedAt: timestamp
          });
        }
        await this.audit("UNDERSTANDING_FEEDBACK_SUBMITTED", dream.id, { status: feedback.status, sessionId: session.id });
      });
      return { dream: clone(updatedDream), session: clone(session), version: clone(version), feedback: clone(record), personalUnderstanding: clone(personalUnderstanding) };
    }
    async deleteDream(dreamId) {
      const dream = await this.requireDream(dreamId);
      const timestamp = this.clock();
      await this.store.transaction(async () => {
        await this.store.put("dreams", dreamId, { ...dream, status: DREAM_STATUS.DELETED, deletedAt: timestamp, updatedAt: timestamp });
        if (dream.sessionId) {
          await this.store.delete("sessions", dream.sessionId);
          const versions = await this.store.list("understanding", (item) => item.sessionId === dream.sessionId);
          for (const version of versions) await this.store.delete("understanding", version.id);
        }
        const personalUnderstandings = await this.store.list("personalUnderstanding", (item) => item.sourceDreamId === dreamId);
        for (const item of personalUnderstandings) await this.store.delete("personalUnderstanding", item.id);
        await this.rebuildUserState(dream.userId);
        await this.audit("DREAM_DELETED", dreamId, { deletedAt: timestamp });
      });
      return { id: dreamId, status: DREAM_STATUS.DELETED, deletedAt: timestamp };
    }
    async getDream(dreamId, { includeDeleted = false } = {}) {
      const dream = await this.store.get("dreams", dreamId);
      if (!dream || !includeDeleted && dream.status === DREAM_STATUS.DELETED) return null;
      return clone(dream);
    }
    async listDreams() {
      const dreams = await this.store.list("dreams", (dream) => dream.status !== DREAM_STATUS.DELETED);
      return dreams.sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
    }
    async getUserState(userId = "local-user") {
      return this.store.get("users", userId);
    }
    async clearAllData() {
      await this.store.clear();
    }
    async listPersonalUnderstandings(userId = "local-user") {
      const items = await this.store.list("personalUnderstanding", (item) => item.userId === userId);
      return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
    async getLatestPersonalUnderstanding(userId = "local-user") {
      const user = await this.getUserState(userId);
      return user?.latestPersonalUnderstandingId ? this.store.get("personalUnderstanding", user.latestPersonalUnderstandingId) : null;
    }
    async getSession(dreamId) {
      const dream = await this.requireDream(dreamId);
      return dream.sessionId ? this.store.get("sessions", dream.sessionId) : null;
    }
    async currentDraft(sessionId) {
      const session = await this.store.get("sessions", sessionId);
      const id = session?.understandingVersionIds?.at(-1);
      return id ? this.store.get("understanding", id) : null;
    }
    async requireDream(dreamId) {
      const dream = await this.getDream(dreamId);
      if (!dream) throw new Error("DREAM_NOT_FOUND");
      return dream;
    }
    async requireSession(dream) {
      const session = dream.sessionId ? await this.store.get("sessions", dream.sessionId) : null;
      if (!session) throw new Error("SESSION_NOT_FOUND");
      return session;
    }
    async updateUnderstandingStatus(dream, status, auditAction) {
      const updated = { ...dream, understandingStatus: status, updatedAt: this.clock() };
      await this.store.put("dreams", dream.id, updated);
      await this.audit(auditAction, dream.id, { status });
      return { dream: clone(updated), session: dream.sessionId ? await this.store.get("sessions", dream.sessionId) : null };
    }
    async ensureUserState(userId = "local-user", { nickname = "toto" } = {}) {
      const existing = await this.store.get("users", userId);
      if (existing) return existing;
      const user = createUserState({ userId, nickname, createdAt: this.clock() });
      await this.store.put("users", userId, user);
      return user;
    }
    async savePersonalUnderstanding({ dream, session, version, claims, confirmedAt }) {
      const user = await this.ensureUserState(dream.userId);
      const previous = await this.store.list("personalUnderstanding", (item) => item.userId === dream.userId && item.status === PERSONAL_UNDERSTANDING_STATUS.CURRENT);
      for (const item of previous) {
        await this.store.put("personalUnderstanding", item.id, { ...item, status: PERSONAL_UNDERSTANDING_STATUS.SUPERSEDED, updatedAt: confirmedAt });
      }
      const confirmedClaims = claims.filter((claim) => claim.userConfirmed && claim.eligibleForLongTerm);
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
      await this.store.put("personalUnderstanding", personalUnderstanding.id, personalUnderstanding);
      const historyItem = {
        id: personalUnderstanding.id,
        sourceDreamId: dream.id,
        summary: personalUnderstanding.summary,
        createdAt: confirmedAt
      };
      const updatedUser = {
        ...user,
        latestPersonalUnderstandingId: personalUnderstanding.id,
        personalUnderstandingIds: [...user.personalUnderstandingIds || [], personalUnderstanding.id],
        recentStatus: {
          summary: personalUnderstanding.summary,
          sourceDreamId: dream.id,
          personalUnderstandingId: personalUnderstanding.id,
          updatedAt: confirmedAt
        },
        history: [...user.history || [], historyItem],
        updatedAt: confirmedAt
      };
      await this.store.put("users", user.id, updatedUser);
      return personalUnderstanding;
    }
    async rebuildUserState(userId = "local-user") {
      const user = await this.store.get("users", userId);
      if (!user) return null;
      const all = await this.store.list("personalUnderstanding", (item) => item.userId === userId);
      const ordered = all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const latest = ordered.at(-1) || null;
      for (const item of ordered) {
        const status = item.id === latest?.id ? PERSONAL_UNDERSTANDING_STATUS.CURRENT : PERSONAL_UNDERSTANDING_STATUS.SUPERSEDED;
        if (item.status !== status) await this.store.put("personalUnderstanding", item.id, { ...item, status, updatedAt: this.clock() });
      }
      const updated = {
        ...user,
        latestPersonalUnderstandingId: latest?.id || null,
        personalUnderstandingIds: ordered.map((item) => item.id),
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
        history: ordered.map((item) => ({ id: item.id, sourceDreamId: item.sourceDreamId, summary: item.summary, createdAt: item.createdAt })),
        updatedAt: this.clock()
      };
      await this.store.put("users", userId, updated);
      return updated;
    }
    async audit(action, entityId, metadata = {}) {
      const id = createId("audit-event");
      await this.store.put("audit", id, { id, action, entityId, metadata, createdAt: this.clock() });
    }
  };
  return __toCommonJS(index_exports);
})();
globalThis.DreamOSMvp = DreamOSMvp;

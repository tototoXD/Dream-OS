import {
  DREAM_STATUS,
  FEEDBACK_STATUS,
  READINESS_ROUTE,
  SESSION_STATE,
  UNDERSTANDING_STATUS
} from './domain.js';

export const ENTRY_CHOICE = Object.freeze({
  NOW: 'now',
  LATER: 'later',
  RECORD_ONLY: 'record-only'
});

const readinessToUnderstanding = new Set([READINESS_ROUTE.ANALYSIS_READY]);

export function assertDreamCanArchive(dream) {
  if (!dream || dream.status === DREAM_STATUS.DELETED) throw new Error('DREAM_NOT_AVAILABLE');
  if (dream.status === DREAM_STATUS.ARCHIVED) return true;
  const hasText = Boolean(dream.raw?.text?.trim());
  const hasAudio = Boolean(dream.raw?.audio);
  if (!hasText && !hasAudio) throw new Error('DREAM_CONTENT_REQUIRED');
  return true;
}

export function assertCanStartUnderstanding(dream, readiness, choice) {
  if (!dream || dream.status !== DREAM_STATUS.ARCHIVED) throw new Error('DREAM_MUST_BE_ARCHIVED');
  if (dream.understandingStatus === UNDERSTANDING_STATUS.CONFIRMED) throw new Error('UNDERSTANDING_ALREADY_CONFIRMED');
  if (choice === ENTRY_CHOICE.RECORD_ONLY || choice === ENTRY_CHOICE.LATER) return true;
  if (choice !== ENTRY_CHOICE.NOW) throw new Error('UNKNOWN_ENTRY_CHOICE');
  if (!readiness || !readinessToUnderstanding.has(readiness.route)) throw new Error('ANALYSIS_NOT_READY');
  return true;
}

export function assertCanAddTurn(session) {
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.state !== SESSION_STATE.EXPLORING) throw new Error('SESSION_NOT_EXPLORING');
  if (session.questionBudget.used >= session.questionBudget.max) throw new Error('QUESTION_BUDGET_EXHAUSTED');
  return true;
}

export function assertCanSubmitFeedback(session, feedback = {}) {
  if (!session || session.state !== SESSION_STATE.REVIEW) throw new Error('SESSION_NOT_IN_REVIEW');
  if (!Object.values(FEEDBACK_STATUS).includes(feedback.status)) throw new Error('UNKNOWN_FEEDBACK_STATUS');
  if (feedback.status === FEEDBACK_STATUS.PARTLY_MATCHES && (!Array.isArray(feedback.selectedClaimIds) || feedback.selectedClaimIds.length === 0)) {
    throw new Error('PARTIAL_FEEDBACK_REQUIRES_SELECTION');
  }
  return true;
}

export function nextUnderstandingStatus(feedbackStatus) {
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
      throw new Error('UNKNOWN_FEEDBACK_STATUS');
  }
}

export function transitionUnderstanding(session, targetState) {
  const allowed = {
    [SESSION_STATE.EXPLORING]: new Set([SESSION_STATE.REVIEW]),
    [SESSION_STATE.REVIEW]: new Set([SESSION_STATE.REVIEW, SESSION_STATE.CONFIRMED, SESSION_STATE.CLOSED_NO_INSIGHT]),
    [SESSION_STATE.CONFIRMED]: new Set(),
    [SESSION_STATE.CLOSED_NO_INSIGHT]: new Set()
  };
  if (!allowed[session.state]?.has(targetState)) throw new Error(`INVALID_SESSION_TRANSITION:${session.state}->${targetState}`);
  return targetState;
}

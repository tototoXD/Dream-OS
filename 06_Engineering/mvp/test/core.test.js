import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DreamOSCore,
  ENTRY_CHOICE,
  FEEDBACK_STATUS,
  MockAiProvider,
  READINESS_ROUTE,
  UNDERSTANDING_STATUS,
  SESSION_STATE,
  MemoryStore,
  LocalStorageStore
} from '../src/index.js';

function createCore() {
  let tick = 0;
  return new DreamOSCore({
    store: new MemoryStore(),
    aiProvider: new MockAiProvider(),
    clock: () => `2026-08-08T07:0${tick++}:00.000Z`
  });
}

test('记录 → 归档：原始内容保留，归档后获得 readiness', async () => {
  const core = createCore();
  const draft = await core.recordDream({ rawText: '我在地库找车，电梯没有 B2，醒来很着急。' });
  assert.equal(draft.status, 'DRAFT');
  const result = await core.archiveDream(draft.id);
  assert.equal(result.dream.status, 'ARCHIVED');
  assert.equal(result.dream.title, '无法抵达的 B2');
  assert.equal(result.readiness.route, READINESS_ROUTE.ANALYSIS_READY);
  assert.equal(result.dream.raw.text, draft.raw.text);
});

test('证据不足时只能先记录，不能强制进入理解', async () => {
  const core = createCore();
  const draft = await core.recordDream({ rawText: '一只猫。' });
  const result = await core.archiveDream(draft.id);
  assert.equal(result.readiness.route, READINESS_ROUTE.RECORD_FIRST);
  await assert.rejects(() => core.chooseUnderstanding(draft.id, ENTRY_CHOICE.NOW), /ANALYSIS_NOT_READY/);
  const saved = await core.chooseUnderstanding(draft.id, ENTRY_CHOICE.RECORD_ONLY);
  assert.equal(saved.dream.understandingStatus, UNDERSTANDING_STATUS.RECORD_ONLY);
  assert.equal(saved.session, null);
});

test('理解会话：候选回答与自由输入共用同一会话，三轮后生成草稿并确认', async () => {
  const core = createCore();
  const draft = await core.recordDream({ rawText: '我在地库找车，电梯没有 B2，醒来很着急。' });
  const { dream } = await core.archiveDream(draft.id);
  const started = await core.chooseUnderstanding(dream.id, ENTRY_CHOICE.NOW);
  assert.equal(started.session.state, SESSION_STATE.EXPLORING);
  const first = await core.sendSessionResponse(dream.id, { text: '着急', selectedOptionId: 'anxious' });
  assert.equal(first.session.state, SESSION_STATE.EXPLORING);
  await core.sendSessionResponse(dream.id, { text: '我一直找另一条路。', selectedOptionId: 'try-another-way' });
  const finished = await core.sendSessionResponse(dream.id, { text: '最近项目也有类似感觉。' });
  assert.equal(finished.session.state, SESSION_STATE.REVIEW);
  assert.equal(finished.draft.status, 'DRAFT');
  assert.ok(finished.draft.claims.length >= 2);

  const confirmed = await core.submitFeedback(dream.id, { status: FEEDBACK_STATUS.MATCHES });
  assert.equal(confirmed.dream.understandingStatus, UNDERSTANDING_STATUS.CONFIRMED);
  assert.equal(confirmed.session.state, SESSION_STATE.CONFIRMED);
  assert.equal(confirmed.version.status, 'CURRENT');
  assert.ok(confirmed.version.claims.some(claim => claim.eligibleForLongTerm));
});

test('补充对话持久化到同一 Understanding Session，拒绝不会变成确认', async () => {
  const core = createCore();
  const draft = await core.recordDream({ rawText: '我在路上一直找出口，醒来很困惑。' });
  const { dream } = await core.archiveDream(draft.id);
  await core.chooseUnderstanding(dream.id, ENTRY_CHOICE.NOW);
  await core.sendSessionResponse(dream.id, { text: '困惑' });
  await core.sendSessionResponse(dream.id, { text: '我继续找' });
  await core.sendSessionResponse(dream.id, { text: '没有对应的现实经历' });
  const supplemented = await core.addSupplement(dream.id, '其实更像是最近的一个选择。');
  assert.ok(supplemented.session.turns.some(turn => turn.content.includes('最近的一个选择')));
  const rejected = await core.submitFeedback(dream.id, { status: FEEDBACK_STATUS.DOES_NOT_MATCH, note: '这不是我的感受' });
  assert.equal(rejected.dream.understandingStatus, UNDERSTANDING_STATUS.CLOSED_NO_INSIGHT);
  assert.equal(rejected.session.state, SESSION_STATE.CLOSED_NO_INSIGHT);
});

test('删除梦境后，默认读取不可见且会话被清理', async () => {
  const core = createCore();
  const draft = await core.recordDream({ rawText: '我在家里看见一扇门，感觉很害怕。' });
  const { dream } = await core.archiveDream(draft.id);
  await core.chooseUnderstanding(dream.id, ENTRY_CHOICE.NOW);
  await core.deleteDream(dream.id);
  assert.equal(await core.getDream(dream.id), null);
  assert.equal((await core.listDreams()).length, 0);
  assert.equal((await core.store.list('sessions')).length, 0);
});

test('只有用户确认的理解才进入 Personal Understanding，并可从本地存储恢复', async () => {
  const storage = new Map();
  const browserStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  };
  const core = new DreamOSCore({
    store: new LocalStorageStore(browserStorage),
    aiProvider: new MockAiProvider(),
    clock: () => '2026-08-08T07:18:00.000Z'
  });
  const draft = await core.recordDream({ rawText: '我在地库找车，电梯没有 B2，醒来很着急。' });
  const { dream } = await core.archiveDream(draft.id);
  await core.chooseUnderstanding(dream.id, ENTRY_CHOICE.NOW);
  await core.sendSessionResponse(dream.id, { text: '着急', selectedOptionId: 'anxious' });
  await core.sendSessionResponse(dream.id, { text: '我一直找另一条路。', selectedOptionId: 'try-another-way' });
  await core.sendSessionResponse(dream.id, { text: '最近项目也有类似感觉。' });
  const confirmed = await core.submitFeedback(dream.id, { status: FEEDBACK_STATUS.MATCHES });

  assert.equal(confirmed.personalUnderstanding.status, 'CURRENT');
  assert.ok(confirmed.personalUnderstanding.claims.length >= 1);
  const userState = await core.getUserState();
  assert.equal(userState.latestPersonalUnderstandingId, confirmed.personalUnderstanding.id);
  assert.equal(userState.recentStatus.sourceDreamId, dream.id);

  const restored = new DreamOSCore({
    store: new LocalStorageStore(browserStorage),
    aiProvider: new MockAiProvider(),
    clock: () => '2026-08-08T07:30:00.000Z'
  });
  assert.equal((await restored.listDreams()).length, 1);
  assert.equal((await restored.listPersonalUnderstandings()).length, 1);
  assert.equal((await restored.getLatestPersonalUnderstanding()).id, confirmed.personalUnderstanding.id);
});

test('部分匹配只保留在梦境理解版本，不写入稳定的 Personal Understanding', async () => {
  const core = createCore();
  const draft = await core.recordDream({ rawText: '我在地库找车，电梯没有 B2，醒来很着急。' });
  const { dream } = await core.archiveDream(draft.id);
  await core.chooseUnderstanding(dream.id, ENTRY_CHOICE.NOW);
  await core.sendSessionResponse(dream.id, { text: '着急' });
  await core.sendSessionResponse(dream.id, { text: '我继续找' });
  await core.sendSessionResponse(dream.id, { text: '最近也有推进不了的事' });
  const draftVersion = await core.currentDraft((await core.getSession(dream.id)).id);
  const partial = await core.submitFeedback(dream.id, {
    status: FEEDBACK_STATUS.PARTLY_MATCHES,
    selectedClaimIds: [draftVersion.claims[0].id]
  });

  assert.equal(partial.dream.understandingStatus, UNDERSTANDING_STATUS.PARTIAL);
  assert.equal(partial.personalUnderstanding, null);
  assert.equal((await core.listPersonalUnderstandings()).length, 0);
  assert.equal((await core.getUserState()).recentStatus.summary, null);
});

test('删除已确认的梦境会清理个人理解及其证据关系', async () => {
  const core = createCore();
  const draft = await core.recordDream({ rawText: '我在地库找车，电梯没有 B2，醒来很着急。' });
  const { dream } = await core.archiveDream(draft.id);
  await core.chooseUnderstanding(dream.id, ENTRY_CHOICE.NOW);
  await core.sendSessionResponse(dream.id, { text: '着急' });
  await core.sendSessionResponse(dream.id, { text: '继续找路' });
  await core.sendSessionResponse(dream.id, { text: '最近也有类似体验' });
  await core.submitFeedback(dream.id, { status: FEEDBACK_STATUS.MATCHES });
  assert.equal((await core.listPersonalUnderstandings()).length, 1);

  await core.deleteDream(dream.id);
  assert.equal((await core.listPersonalUnderstandings()).length, 0);
  const state = await core.getUserState();
  assert.equal(state.latestPersonalUnderstandingId, null);
  assert.equal(state.recentStatus.summary, null);
  assert.equal((await core.store.list('understanding')).length, 0);
});

test('清除本机数据会清空所有 MVP 集合', async () => {
  const core = createCore();
  await core.recordDream({ rawText: '一个房间。' });
  assert.ok((await core.store.list('dreams')).length > 0);
  await core.clearAllData();
  assert.equal((await core.store.list('dreams')).length, 0);
  assert.equal((await core.store.list('users')).length, 0);
  assert.equal((await core.store.list('audit')).length, 0);
});

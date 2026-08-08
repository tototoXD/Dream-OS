# Dream OS MVP 数据模型与 AI 接口契约 v1.1

**状态：** Engineering baseline  
**更新日期：** 2026-08-08  
**实现：** `src/domain.js`、`src/core.js`、`src/store.js`、`src/ai-provider.js`

## 1. 数据边界

### DreamRecord

```json
{
  "id": "dream_x",
  "userId": "user_x",
  "status": "ARCHIVED",
  "title": "无法抵达的 B2",
  "raw": {
    "text": "我在地库找车……",
    "audio": null,
    "inputType": "USER_TEXT"
  },
  "capturedAt": "2026-08-08T07:18:00.000Z",
  "analysisRoute": "ANALYSIS_READY",
  "readinessAssessments": [],
  "userAdditions": [],
  "understandingStatus": "NOT_STARTED",
  "sessionId": null,
  "understandingVersions": [],
  "feedback": []
}
```

`raw.text` 和 `raw.audio` 是事实源，不能被 AI 摘要覆盖。补充内容进入 `userAdditions`，不能回写原始梦境。一个 `DreamRecord` 只允许一个 `sessionId`。

### UnderstandingSession

会话保存状态、问题预算、焦点和逐条原始对话。`turns` 中用户选择和自由输入使用同一结构，只通过 `source` 与 `selectedOptionId` 区分。

```json
{
  "id": "session_x",
  "dreamId": "dream_x",
  "state": "REVIEW",
  "questionBudget": { "default": 3, "max": 5, "used": 3 },
  "turns": [],
  "understandingVersionIds": []
}
```

### UnderstandingVersion / Claim

草稿、用户反馈和最终确认都保留版本。Claim 只允许四种层级：`OBSERVATION`、`HYPOTHESIS`、`UNCERTAINTY`、`WATCH_ITEM`。`eligibleForLongTerm` 只有在用户确认且证据达到最低要求时才为 `true`。

### UserState

`UserState` 是首页“近期状态”和“历史变化”的本地聚合，不是人格画像，也不承载未确认的模型推断。用户第一次记录梦境时创建：

```json
{
  "id": "local-user",
  "userId": "local-user",
  "nickname": "toto",
  "recentStatus": {
    "summary": "知道方向，却暂时推进不了。",
    "sourceDreamId": "dream_x",
    "personalUnderstandingId": "personal-understanding_x",
    "updatedAt": "2026-08-08T07:30:00.000Z"
  },
  "latestPersonalUnderstandingId": "personal-understanding_x",
  "personalUnderstandingIds": ["personal-understanding_x"],
  "history": []
}
```

### PersonalUnderstanding

这是用户明确选择“很贴近”后形成的阶段性个人理解快照。它只复制已确认且有足够证据的 Claim，不回写 DreamRecord，也不把草稿、部分匹配或拒绝内容写入稳定模型。新快照生成时，旧快照标记为 `SUPERSEDED`，因此可以展示近期状态和历史变化：

```json
{
  "id": "personal-understanding_x",
  "userId": "local-user",
  "sourceDreamId": "dream_x",
  "sourceSessionId": "session_x",
  "sourceUnderstandingVersionId": "understanding_x",
  "version": 1,
  "status": "CURRENT",
  "summary": "知道方向，却暂时推进不了。",
  "claims": [],
  "confirmedAt": "2026-08-08T07:30:00.000Z"
}
```

### 本地存储边界

`LocalStorageStore` 持久化 `dreams`、`sessions`、`understanding`、`personalUnderstanding`、`users` 和 `audit` 六个集合。读取时缺失的新集合会自动初始化为空集合，兼容此前的 MVP 本地状态。删除梦境会同步删除其会话、理解版本和个人理解证据关系。

## 2. AI Provider 接口

Core 只依赖以下异步接口，不依赖具体模型供应商：

| 方法 | 输入 | 输出 | 目的 |
| --- | --- | --- | --- |
| `assessReadiness` | DreamRecord、用户补充、可见历史 | `ReadinessAssessment` | 选择分析、澄清、先记录、身体优先或安全路由 |
| `startSession` | DreamRecord、ReadinessAssessment | 第一条 AI Turn + 选项 | 从梦境直接体验开始提问 |
| `continueSession` | Session、最新 User Turn | 下一条 AI Turn + 选项 | 一次推进一个问题 |
| `formulateUnderstanding` | DreamRecord、完整 Session | Understanding Draft | 生成观察、假设、不确定和依据 |
| `respondToSupplement` | DreamRecord、Session、补充文字 | AI Turn | 在结果页继续开放式补充 |

### ReadinessAssessment 最小输出

```json
{
  "schemaVersion": "dream-os-ai-1.0",
  "modelVersion": "model-or-mock-version",
  "route": "ANALYSIS_READY",
  "hardGateResults": {
    "minimumMaterial": true,
    "safety": true,
    "bodyContext": true,
    "userConsent": true
  },
  "dimensions": {
    "emotionalClarity": "MODERATE",
    "personalGrounding": "WEAK",
    "wakingContinuity": "UNKNOWN",
    "repetition": "UNKNOWN",
    "narrativeStructure": "MODERATE",
    "alternativeControl": "MODERATE",
    "userConsent": "STRONG"
  },
  "supportingEvidence": ["在", "找", "着急"],
  "missingInformation": [],
  "alternativeExplanations": ["普通记忆重组或近期事件"],
  "clarificationBudget": 0,
  "decisionReason": "梦境同时包含场景、行动或感受中的至少两类可核对材料。"
}
```

### Understanding Draft 最小输出

```json
{
  "version": 1,
  "summary": "知道方向，却暂时推进不了。这个理解仍然可以继续修正。",
  "claims": [
    {
      "id": "claim_x",
      "type": "HYPOTHESIS",
      "text": "这段梦可能和近期类似的推进受阻体验有关。",
      "evidence": [
        {
          "sourceType": "USER_TEXT",
          "sourceId": "dream_x",
          "excerpt": "我在地库找车……",
          "relation": "DIRECT_QUOTE"
        }
      ],
      "alternativeExplanations": ["普通记忆重组或近期事件"],
      "userConfirmed": false,
      "eligibleForLongTerm": false
    }
  ]
}
```

## 3. 强制约束

- Provider 不得返回诊断、人格定性或隐藏推理文本。
- `RECORD_FIRST` 不得返回 `HYPOTHESIS` 作为用户结果。
- 每个 Claim 必须有证据，或明确标记为 `UNCERTAINTY`。
- 所有历史引用必须由 UI 先展示，才允许进入下一次模型请求。
- Provider 失败时 Core 保留原始梦境和会话草稿，不自动生成替代结论。
- 只有 `MATCHES` 且至少存在一条 `eligibleForLongTerm` Claim 时，才允许生成 `PersonalUnderstanding`。
- `PARTLY_MATCHES`、`DOES_NOT_MATCH`、`UNSURE` 和 `USER_REWRITE` 只保留在梦境的理解版本/会话中，不更新稳定的 `UserState.recentStatus`。
- 所有请求需带 `schemaVersion`、`modelVersion` 和幂等键；生产 API 还要绑定 `userId` 与鉴权上下文。

## 4. 生产替换点

当前 `MockAiProvider` 只用于本地验收，不代表心理模型质量。真实接入时新增 `ApiAiProvider`，保持相同方法签名；Core、Store 和 UI 不应感知供应商名称、Prompt 或模型 SDK。

# Dream OS MVP 工程冻结说明 v1.0

**状态：** Engineering baseline  
**更新日期：** 2026-08-08  
**对应原型：** `05_UX/prototype/index.html`  
**对应产品文档：** `03_PRD/Dream_OS_PRD_v1.2.md`

## 1. 冻结的 MVP 目标

Dream OS MVP 只验证一个闭环：用户能快速留下梦境，选择是否理解，完成一次短澄清，并在下次回来时找回原始梦境与阶段性理解。

### 必须交付

1. 记录：文字输入和语音转写写入同一个 Dream Record；原始内容不可被 AI 覆盖。
2. 归档：保存后生成描述性标题、时间和原样记录，Dreams 可滚动查看、删除和按日期查看。
3. 理解：一梦一 Understanding Session；默认 3 个问题，最多 5 个；支持候选项、自由文字、语音回答。
4. 选择：用户可现在理解、稍后理解或只保存，不同意理解不创建分析结论。
5. 反馈：理解草稿必须经过用户反馈；“很贴近”才结束为已确认，其余反馈保留为未确认草稿或补充对话。
6. 安全：结果明确不是心理诊断；证据不足时只记录，不强行解释。
7. 隐私：MVP 说明数据保存在本机/服务端的边界，并提供清除入口。

### 明确不做

- 未成年人、家庭/监护人账户和危机资源本地化；
- 独立图数据库、复杂搜索、跨梦编辑、自动推送；
- 自动把单个梦写入 Personal Understanding；
- 用户未明确看到的历史引用；
- 真实语音文件上传、云同步和账号体系（先由接口契约隔离）。

## 2. 核心验收标准

| 场景 | 通过标准 |
| --- | --- |
| 新用户第一次记录 | 没有示例心理模型；保存后只展示这条真实梦境和当前状态 |
| 只保存不理解 | 梦境进入归档，理解状态为 `RECORD_ONLY`，不生成 Hypothesis |
| 继续理解 | 离开后重新进入仍能恢复问题、回答和剩余问题预算 |
| 理解完成 | 先显示草稿；只有“很贴近”才进入 `CONFIRMED` |
| 补充/不太像 | 补充内容可恢复；拒绝内容不会被当成确认写入 |
| 删除 | 梦、语音引用、会话和证据边全部停止被读取 |
| 证据不足 | Readiness 为 `RECORD_FIRST`，界面不提供强制分析入口 |

## 3. MVP 状态机

### Dream Record 状态

```text
DRAFT → ARCHIVED → DELETED
             └────→ ARCHIVED（保留原始记录，理解状态独立变化）
```

### 理解状态

```text
NOT_STARTED
  ├─ choose("later")       → DEFERRED
  ├─ choose("record-only") → RECORD_ONLY
  └─ choose("now")         → EXPLORING

EXPLORING → REVIEW → CONFIRMED
     │         ├─ supplement → REVIEW
     │         ├─ partial    → REVIEW（只保存被选中的部分）
     │         ├─ reject     → CLOSED_NO_INSIGHT
     │         └─ unsure     → CLOSED_NO_INSIGHT
     └─ leave  → EXPLORING（会话草稿持久化）
```

### 状态守卫

- `ARCHIVED` 之前不能创建 Understanding Session。
- `RECORD_FIRST` 不能被 UI 绕过；只有新材料触发重新评估。
- 一个 `dreamId` 最多一个 session；更新结果使用 `understandingVersion`，不覆盖旧版本。
- `CONFIRMED` 必须有用户反馈时间和至少一条可追溯证据。
- `PARTIAL` 必须有 `selectedClaimIds`，否则拒绝写入。
- `DELETED` 对所有读取接口不可见，不能重新进入理解。

## 4. 工程分层

```text
UI / prototype
      ↓
DreamOSCore（状态转换与用例）
      ↓
Store（本地或服务端持久化）  +  AiProvider（真实模型或 Mock）
```

UI 不直接修改梦境对象；所有改变通过 Core 用例完成。这样可以先用本地 Store 验证体验，再替换为账号、API 和加密存储。

## 5. 发布闸门

工程单元测试通过后，必须完成 3–5 名成年用户的真实测试，重点观察：

- 用户是否理解“只记录”和“现在理解”的差异；
- 用户是否把阶段性理解误认为诊断；
- 用户能否恢复未完成会话；
- 用户是否知道梦境原文和补充内容的保存边界。

本文件冻结的是 MVP 的工程边界，不代表可以跳过真实用户验证或安全评审。

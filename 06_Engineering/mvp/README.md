# Dream OS MVP Core

这里是正式 App 开发的第一层工程基线。它把低保真原型中的三条主链路抽成可测试的领域服务，并将用户确认后的阶段性理解持久化为独立数据层：

```text
记录 → 归档 + Readiness → 选择是否理解 → Understanding Session → 草稿反馈 → Personal Understanding
```

`05_UX/prototype/index.html` 继续承担交互走查；本目录承担后续 App 的状态、数据和 AI 接口边界。真实数据库、账号系统和模型供应商可以在不改 UI 用例的情况下替换。

当前开发范围以 [`MVP_SCOPE_FREEZE_v1.1.md`](./MVP_SCOPE_FREEZE_v1.1.md) 作为 UI 与交互唯一冻结基线；状态转换和数据约束继续以 [`MVP_SCOPE_AND_STATE_MACHINE_v1.0.md`](./MVP_SCOPE_AND_STATE_MACHINE_v1.0.md) 为准。

## 运行检查

在本目录执行：

```bash
npm test
npm run check
```

## 核心入口

- `src/domain.js`：DreamRecord、UserState、Session、UnderstandingVersion、PersonalUnderstanding、Claim 与枚举。
- `src/state-machine.js`：状态守卫和反馈转换。
- `src/ai-provider.js`：真实模型必须实现的接口，以及仅供本地测试的 Mock Provider。
- `src/store.js`：MemoryStore 与浏览器 LocalStorageStore；生产环境替换为 API Store。LocalStorage 目前持久化六个集合：梦境、会话、理解版本、个人理解、用户状态和审计日志。
- `src/core.js`：记录、归档、理解和反馈用例。

数据层读取入口：`getUserState()`、`listPersonalUnderstandings()`、`getLatestPersonalUnderstanding()`。UI 通过这些入口读取“近期状态”和“历史变化”，不直接访问 Store。清除本机数据统一调用 `clearAllData()`。

当前原型已通过 `05_UX/prototype/index.html` 接入 Core：新记录会同时写入 `DreamRecord`，开始理解/回答/确认会写入对应的 Session 与 Personal Understanding。页面默认加载 `dist/dream-os-mvp.iife.js`，因此直接以 `file://` 打开也能运行；Core 源码变更后重新执行：

```bash
npx --yes esbuild@0.25.0 src/index.js --bundle --format=iife --global-name=DreamOSMvp --outfile=dist/dream-os-mvp.iife.js
```

## 生产接入约束

1. UI 不直接写 Store，只调用 `DreamOSCore`。
2. AI Provider 不得返回隐藏推理；每条 Claim 必须包含证据或明确不确定。
3. 一个 DreamRecord 只能创建一个 UnderstandingSession。
4. `RECORD_FIRST`、身体因素和安全路由不能被 UI 强制绕过。
5. 原始文字/音频和 AI 推断使用不同字段，禁止覆盖原文。
6. 只有用户确认且证据达标的 Claim 才能进入 Personal Understanding；部分匹配不会更新近期状态。

## 手机安装与真实 AI

当前原型已补齐 PWA 壳：`05_UX/prototype/manifest.webmanifest`、`sw.js` 和应用图标。手机端需要通过 HTTPS 地址打开，浏览器才会允许“添加到主屏幕”；直接打开 `file://` 只能做本地演示，不能安装为手机 App。

真实模型走服务端，不把 `ZHIPU_API_KEY` 放进前端。服务端位于 `server/`，默认使用智谱 GLM，实现了五个 Understanding Provider 方法；`/api/transcribe` 只有配置了支持转写的供应商后才启用：

```bash
cd "/Users/toto/Documents/Dream OS/06_Engineering/mvp"
cp server/.env.example server/.env
# 只在本机 server/.env 中填入 ZHIPU_API_KEY
npm run server
```

服务启动后，电脑打开 `http://127.0.0.1:8787/` 就能看到原型；它同时托管原型静态文件和 `/api` 接口。

原型默认使用 Mock Provider，因此没有密钥也能走交互。要切换真实 AI：复制 `05_UX/prototype/config.example.js` 为同目录的 `config.js`，再用 HTTP 服务打开原型；`config.js` 只保存服务地址，绝不保存密钥。模型默认是 `glm-5.2`。如需切回 OpenAI，将 `AI_PROVIDER` 改为 `openai`，再配置对应的 `OPENAI_API_KEY`。

部署到手机前还需要把静态原型和这个 API 服务放到同一个 HTTPS 域名（或由反向代理转发 `/api`）。本地 `127.0.0.1` 服务只适用于电脑走通链路，不会让手机直接访问到电脑密钥。Expo App 的 `.env` 只填写服务端 HTTPS 地址，不填写智谱 Key。

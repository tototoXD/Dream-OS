# Dream OS 手机与真实 AI 接入

## 现在已经完成的部分

- 原型具备 PWA 安装所需的 manifest、Service Worker 和图标。
- `server/` 提供服务端 AI 代理，浏览器不会接触 `ZHIPU_API_KEY`。
- Understanding 的五个 AI 方法默认走智谱 GLM Chat Completions API；语音转写仍需单独配置支持转写的供应商。
- 未配置密钥时仍使用 Mock Provider，便于继续走交互，不会误把演示结果当成真实分析。

## 电脑上先走通真实 AI

```bash
cd "/Users/toto/Documents/Dream OS/06_Engineering/mvp"
cp server/.env.example server/.env
```

用文本编辑器打开 `server/.env`，只在本机填入 `ZHIPU_API_KEY`。不要把密钥写进 `index.html`、`config.js`，也不要粘贴到聊天中。默认模型是 `glm-5.2`，可按智谱账号可用模型调整 `ZHIPU_MODEL`。

再复制前端配置：

```bash
cp "/Users/toto/Documents/Dream OS/05_UX/prototype/config.example.js" \
   "/Users/toto/Documents/Dream OS/05_UX/prototype/config.js"
cd "/Users/toto/Documents/Dream OS/06_Engineering/mvp"
npm run server
```

浏览器打开 `http://127.0.0.1:8787/`。首页应显示“真实 AI 已连接”。如果显示“本机演示模式”，说明还没有加载 `config.js`。

## 手机上使用

手机不能直接安装 `file://` 文件。需要把同一套 Node 服务部署到 HTTPS 域名，并在部署平台设置 `ZHIPU_API_KEY` 环境变量；不要把密钥提交到 GitHub。

如果只是让当前 Expo Go 手机和电脑在同一 Wi‑Fi 下联调，可临时使用局域网地址：

```bash
# 06_Engineering/mvp/server/.env
HOST=0.0.0.0

# 07_App/.env；把地址中的 IP 换成运行服务的电脑 IP
EXPO_PUBLIC_AI_API_BASE_URL=http://192.168.x.x:8787/api
```

先启动 AI 服务，再重启 Expo（让它重新读取 `.env`）：

```bash
cd "/Users/toto/Documents/Dream OS/06_Engineering/mvp" && npm run server
cd "/Users/toto/Documents/Dream OS/07_App" && npx expo start --lan --clear
```

局域网联调只适合开发测试；正式手机使用仍应部署 HTTPS 服务。

- iPhone：Safari 打开 HTTPS 地址 → 分享 → 添加到主屏幕。
- Android：Chrome 打开 HTTPS 地址 → 安装应用 / 添加到主屏幕。

部署时让静态原型与 `/api` 使用同一域名，或由反向代理把 `/api` 转发到 Node 服务。上线前还应把 `ALLOWED_ORIGIN` 改成实际 HTTPS 域名，并增加账号鉴权、速率限制和费用上限。

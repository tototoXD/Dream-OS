# Dream OS Native App

这是 Dream OS 的真实移动端第一版，使用 Expo SDK 54 + React Native，目标是 iOS 和 Android。SDK 54 是当前 Expo Go 真机预览的兼容基线；未来切换 Development Build 时可升级到更新的 SDK。

## 已实现

- 原生首页与液体玻璃视觉层（当前 Expo Go 使用半透明玻璃降级样式；正式 Development Build 可升级到 Expo 原生 GlassView）。
- 记录梦境：进入页面自动聚焦，便签记录，输入后显示“存档梦境”。
- 梦境历史：使用 AsyncStorage 保存在本机。
- 理解：三轮澄清式对话，候选选项纵向呈现。
- 图谱：以“车”为中心节点的 MVP 关系图。
- AI Provider：如果配置 `EXPO_PUBLIC_AI_API_BASE_URL`，会调用现有服务端 `/api/ai`；没有配置时保留本地演示模式。

## 本地启动

```bash
cd "/Users/toto/Documents/Dream OS/07_App"
npm install
npm run start
```

用手机安装 Expo Go 扫描终端二维码即可预览；正式产品构建应使用 Expo development build / EAS，而不是把 Expo Go 当成生产 App。

## 连接真实 AI

复制 `.env.example` 为 `.env`，填写服务端 HTTPS 地址：

```bash
cp .env.example .env
```

`.env` 只能保存服务地址，智谱 API Key 必须留在 `06_Engineering/mvp/server/.env` 或部署平台的服务端环境变量中。

如果手机和电脑在同一 Wi‑Fi，可把服务地址临时写成 `http://电脑局域网IP:8787/api`，并将服务端 `HOST` 设为 `0.0.0.0`；正式使用请改为 HTTPS 地址。修改 `.env` 后需要重启 Expo。

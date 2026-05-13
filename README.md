# 智语心聊 MindTree

智语心聊，是一个面向情绪记录和支持性对话的项目。项目采用前后端分离结构，前端负责会话管理、流式渲染、Markdown 安全渲染和语音输入，后端负责模型接口代理、系统提示词注入和流式响应转发。

本项目不提供心理诊断，也不能替代专业心理咨询或医疗服务。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | Vue 3, Vite, Vue Router, Pinia |
| 后端 | Node.js 原生 http/https 模块 |
| 状态 | Pinia, localStorage |
| 流式响应 | fetch ReadableStream, SSE 文本协议 |
| 内容渲染 | marked, DOMPurify, highlight.js |
| 长列表 | vue-virtual-scroller |
| 语音输入 | Web Speech API |
| 模型接口 | 讯飞星火 MaaS OpenAI 兼容接口 |

## 功能范围

- 多会话创建、切换、重命名和删除
- 会话内容本地持久化
- 大模型流式回复
- 用户主动停止生成
- Markdown 渲染和代码块高亮
- AI 输出内容 XSS 过滤
- 长对话虚拟列表渲染
- 底部跟随滚动控制
- 语音输入和中间结果预览
- 危机表达检测和求助提示
- 浅色、深色、冷色三套主题

## 实现说明

### 流式对话

前端在 `src/api/chat.js` 中使用 `fetch` 请求后端 `/api/chat`。响应体通过 `response.body.getReader()` 逐块读取，使用 `TextDecoder` 解码二进制内容，并按 SSE 的空行分隔规则解析 `data:` 行。

模型返回的增量文本会先进入 `useChat.js` 内部的 buffer，再通过 50ms 节流写入 Pinia store，避免每个 token 都触发一次响应式更新。

### 中断生成

前端为每次请求创建 `AbortController`，点击停止按钮时调用 `abort()`。后端监听响应对象的 `close` 事件，在客户端断开后销毁上游模型请求，避免继续消耗资源。

### 会话状态

`src/stores/chat.js` 使用 `Map<sessionId, Session>` 管理会话。Map 适合按 id 查询、删除和保持插入顺序。由于 Map 不能直接 JSON 序列化，写入 localStorage 前会转成数组结构。

### Markdown 安全渲染

AI 回复通过 marked 转为 HTML，再经过 DOMPurify 白名单过滤后使用 `v-html` 渲染。代码块使用 highlight.js 高亮，并按需注册常见语言，避免引入完整语言包。

### 危机表达检测

前端在 `src/utils/crisis.js` 中对用户输入做本地关键词匹配。命中后，`CrisisNotice.vue` 展示安全提醒和求助入口。后端也会检测最近一条用户消息，命中时额外注入安全回应提示词，要求模型优先确认用户安全，不提供危险细节。

这部分只是风险提示和安全边界控制，不能替代专业干预。

### 长列表渲染

消息列表使用 vue-virtual-scroller 的 `DynamicScroller`。对于流式追加导致的高度变化，组件通过 `size-dependencies` 让当前项重新测量高度。滚动控制只在用户接近底部时自动跟随，避免用户查看历史消息时被拉回底部。

### 语音输入

语音输入基于浏览器 Web Speech API。Chrome 和 Edge 支持较好，其他浏览器不支持时会隐藏语音入口或给出错误提示。最终识别结果写入输入框，中间结果单独展示。

## 目录结构

```text
mindtree/
├── mindtree-backend/
│   ├── index.js
│   ├── package.json
│   └── .env.example
├── mindtree-frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── api/
│       ├── assets/
│       ├── components/
│       ├── composables/
│       ├── router/
│       ├── stores/
│       ├── utils/
│       └── views/
└── docs/
    └── interview-prep.md
```

## 本地运行

### 后端

```bash
cd mindtree-backend
npm install
cp .env.example .env
npm start
```

`.env` 中需要配置：

```bash
XUNFEI_API_KEY=your_api_key
PORT=3000
MODEL=xop3qwen1b7
CORS_ORIGIN=*
MAX_BODY_BYTES=1048576
```

### 前端

```bash
cd mindtree-frontend
npm install
cp .env.example .env.local
npm run dev
```

开发环境默认通过 Vite proxy 请求 `http://localhost:3000`。如果后端部署在其他地址，在 `.env.local` 中配置：

```bash
VITE_API_BASE_URL=https://your-backend-domain.com
```

## 构建

```bash
cd mindtree-frontend
npm run build
```

后端语法检查：

```bash
cd mindtree-backend
node --check index.js
```

## 项目边界

- 当前版本没有用户账号系统。
- 会话主要保存在浏览器 localStorage。
- 后端没有数据库持久化。
- 危机识别是规则匹配，不是医学判断。
- 模型回复质量取决于上游模型能力和提示词约束。

## 可继续改进

- 后端接入数据库保存会话
- 增加用户登录和鉴权
- 增加长会话摘要压缩
- 增加情绪评分和趋势图
- 增加部署脚本和线上环境配置说明

## License

MIT

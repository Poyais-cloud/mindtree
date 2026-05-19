# MindTree · 智语心聊

一个情绪支持对话工具。可以和你聊天，也可以读你上传的资料，结合资料内容回复。

**注意：这不是心理诊断工具，不能替代专业咨询或医疗。**

## 功能

- 多会话管理（新建、切换、重命名、删除）
- 流式回复，可随时停止生成
- 对话记录保存在浏览器本地，不传服务器
- 语音输入（Chrome / Edge）
- Markdown 渲染 + 代码高亮，AI 输出走 XSS 过滤
- 长对话虚拟列表
- 三套主题（浅色、深色、冷色）
- 危机表达检测（前后端双重），命中后弹出求助提示 + 热线电话
- **RAG 知识库**：上传 md / txt / json 文件，对话时自动检索并引用
- **MCP Server**：独立 MCP 服务，可在 Claude Code / Cursor 里直接配置使用

## 技术栈

| 模块 | 用了什么 |
| --- | --- |
| 前端 | Vue 3, Vite, Vue Router, Pinia |
| 后端 | Express, multer, MCP SDK |
| 流式 | SSE 命名事件（token / tool / citations / done / error） |
| 渲染 | marked, DOMPurify, highlight.js |
| 虚拟列表 | vue-virtual-scroller |
| 语音 | Web Speech API |
| 向量 | Qwen text-embedding-v3（可选，不配也能跑） |
| 模型接口 | 讯飞星火 MaaS（OpenAI 兼容），可换其他兼容接口 |

## RAG 是怎么跑的

1. 前端上传文件 → `POST /api/knowledge/upload`
2. 后端调 MCP `ingest_knowledge_documents`：按段落分块 → 分词 → 可选 embedding → 建索引
3. 用户发消息 → 后端调 MCP `retrieve_knowledge`，用**混合检索**（embedding + BM25 关键词加权）拿相关片段
4. 片段注入 System Prompt 给模型做参考，同时通过 SSE `citations` 事件发给前端展示
5. 知识库存为 JSON 文件（`data/knowledge.json`），重启不会丢

如果没配 Qwen embedding，会自动退化为纯 BM25 关键词检索，RAG 流程不受影响。

## 实现说明

### 流式对话

前端 `api/chat.js` 用 `fetch` + `ReadableStream` 读 SSE，按 `event:` 和 `data:` 行解析。后端发四种命名事件——`token`（增量文本）、`tool`（工具调用状态）、`citations`（检索结果）、`done`/`error`。

增量文本进 `useChat.js` 的 buffer，50ms 节流写入 Pinia store，避免每个 token 都触发响应式更新。

### MCP / Agent

后端启动时 spawn `mcp-server.js` 作为 MCP 子进程，通过 stdio 通信。内置六个工具：

- `retrieve_knowledge` — 混合检索知识库
- `list_knowledge_documents` — 列出已上传资料
- `ingest_knowledge_documents` — 导入资料并建索引
- `delete_knowledge_document` — 删除指定资料
- `clear_knowledge_documents` — 清空知识库
- `get_current_time` — 获取当前时间

`mcp-server.js` 也可以脱离后端单独跑，作为 Claude Code 的 MCP 工具使用。

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
│   ├── mcp-server.js
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
MAX_KNOWLEDGE_FILE_BYTES=2097152

# 可选：启用 embedding 向量检索
QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_EMBEDDING_MODEL=text-embedding-v3
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
node --check mcp-server.js
```

## 项目边界

- 没有用户账号系统
- 会话存在浏览器 localStorage
- 知识库存为本地 JSON 文件，不依赖外部数据库
- 危机识别是规则匹配，不是医学判断
- 模型回复质量取决于上游模型和提示词

## 还没做的

- 用户登录和鉴权
- 长会话摘要压缩（目前截断到最近 18 条消息）
- 情绪评分和趋势图
- 部署文档

## License

MIT

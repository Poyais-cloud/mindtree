# 智语心聊· MindTree

> 基于大语言模型的智能心理对话研究系统。面向情绪健康场景，支持多轮上下文、流式输出、语音输入和历史对话回溯。

![Vue](https://img.shields.io/badge/Vue-3.4-42b883) ![Vite](https://img.shields.io/badge/Vite-5-646CFF) ![Pinia](https://img.shields.io/badge/Pinia-2-FFD859) ![Node](https://img.shields.io/badge/Node-18%2B-339933)

---

## 一、项目定位

本项目面向心理健康场景，构建一个智能对话研究系统，探索大语言模型在情绪陪伴和心理干预中的应用潜力：

- 后端注入专业心理陪伴 **System Prompt**（倾听优先、不做诊断、危机干预）
- 针对情绪场景设计 **话题引导模板**，降低用户开口门槛
- 3 套主题风格（温暖米 / 深色夜间 / 清晨蓝），适配不同使用氛围
- 支持**语音输入**，适合移动端或不便打字的场景
- 带有医疗免责声明和求助热线引导

---

## 二、技术栈

| 层       | 技术                                                               |
| -------- | ------------------------------------------------------------------ |
| 前端框架 | Vue 3 (Composition API +`<script setup>`)                        |
| 状态管理 | Pinia（`Map` 管理多会话，独立 preferences store 管主题）         |
| 构建工具 | Vite 5（路由懒加载 + 按需分包）                                    |
| 路由     | Vue Router 4 + Suspense 异步边界                                   |
| 长列表   | **vue-virtual-scroller（DynamicScroller 动态高度虚拟列表）** |
| Markdown | marked + DOMPurify（XSS 防护）                                     |
| 代码高亮 | **highlight.js**（按需注册语言，避免 500KB 全量引入）        |
| 语音识别 | **Web Speech API**（低延迟、浏览器原生）                     |
| 后端     | 原生 Node.js（零依赖除 dotenv）                                    |
| 模型接入 | 讯飞星火 MaaS（OpenAI 兼容接口）                                   |
| 通信协议 | SSE（Server-Sent Events）流式传输                                  |

---

## 三、项目简介

### 1. 流式数据实时渲染与性能优化

- `fetch + ReadableStream + TextDecoder` 手动解析 SSE 协议
- `buffer` 缓冲跨 chunk 不完整行（中文字符跨块边界）
- `decoder.decode(value, { stream: true })` 避免中文乱码
- 节流 50ms 批量 flush，减少 DOM diff 次数，流式更新从"每 token 一次渲染"降到"每 50ms 一次"

### 2. AbortController 实现"停止生成"

- 前端持有 `AbortController`，点击停止按钮 `.abort()`
- 后端监听 `res.on('close')` 同步销毁对上游 LLM 的请求
- 避免用户已走、后端还在烧 token 的资源浪费

### 3. 虚拟列表（长对话性能优化）

- 用 `vue-virtual-scroller` 的 `DynamicScroller` 渲染历史消息
- DOM 节点从 O(N) 降到 O(V)（V = 视口 + 缓冲区常数）
- `size-dependencies` 属性解决流式追加导致高度变化的测量问题
- 方案对比：**全量 v-for vs 分页 vs 虚拟列表**，各有取舍（README 九节详细讲）

### 4. 语音输入（Web Speech API）

- 浏览器原生识别，延迟 < 200ms，边说边出文字
- `interimResults` 中间结果 + `continuous` 连续识别
- 错误分类处理：权限拒绝 / 无语音 / 麦克风缺失 / 网络错
- 降级：不支持的浏览器（如 Firefox）隐藏语音按钮而不是报错

### 5. 智能滚动跟随

- 判断用户是否"粘在底部"（阈值 80px），只在跟随态自动滚
- 用户上翻历史时锁定滚动位置，不会被强拉回底部
- 这是流式对话里最容易被面试官挑刺的细节

### 6. Map 管理多会话 + 防抖持久化

- 查询/删除 O(1)，保留插入顺序，天然适合会话场景
- 方案对比：数组 O(n) 查找、对象字典无序、**Map 全面胜出**
- 持久化用 debounce 500ms 批量写 localStorage，避免频繁序列化

### 7. Markdown 渲染的两个隐藏 bug 修复

- **Bug A**：LLM 有时把整个回复包在 ` ```markdown ... ``` ` 里，
  导致 `**` 和 `#` 显示为字面量字符 —— 预处理剥离外层 fence 修复
- **Bug B**：流式到一半时，开 `` ``` `` 已到但闭合未到，
  后续内容全部被当成代码块 —— 虚拟补一个闭合 ``` 修复
- 详见 `src/utils/markdown.js`（面试时可以特意讲这个"别人想不到的坑"）

### 8. 主题切换（CSS 变量）

- 3 套配色：温暖米（默认）/ 深色夜间 / 清晨蓝
- 方案：`<html data-theme="x">` + CSS 变量，纯 CSS 无运行时开销
- 独立 preferences store 管理，自动持久化到 localStorage

### 9. XSS 防护

- AI 输出虽然"理论不是用户输入"，但可能被**提示词注入**诱导返回 XSS payload
- DOMPurify 白名单策略：剥离 `on*` 事件、`<script>`、`<iframe>`
- 允许 `class` 属性（不然 hljs 高亮会失效），但禁止内联样式

### 10. 中文输入法兼容

- textarea 用 `compositionstart/end` 标志位
- 输入法组合中按 Enter 不触发发送 —— 中文产品必做细节

### 11. defineAsyncComponent + Suspense

- 路由懒加载（`() => import()`）+ Suspense `#fallback` 过渡
- 避免路由切换时的白屏瞬间，用 loading spinner 填充

---

## 四、目录结构

```
mindtree/
├── mindtree-backend/              # 后端：单文件 Node 服务
│   ├── index.js                    # 入口 + 路由 + SSE 转发 + System Prompt
│   ├── package.json
│   └── .env.example
│
└── mindtree-frontend/             # 前端：Vue 3 + Vite
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.js                 # 应用入口
        ├── App.vue                 # 根组件（Suspense 边界）
        ├── router/                 # 路由（懒加载）
        ├── api/
        │   └── chat.js             # SSE 流式请求核心
        ├── stores/
        │   ├── chat.js             # Pinia 多会话 Store（Map 结构）
        │   └── preferences.js      # 主题等偏好
        ├── composables/
        │   ├── useChat.js          # 对话业务逻辑封装
        │   ├── useAutoScroll.js    # 智能滚动跟随
        │   └── useSpeechRecognition.js  # 语音识别封装
        ├── utils/
        │   ├── throttle.js         # 节流实现
        │   └── markdown.js         # Markdown + 高亮 + XSS 防护
        ├── components/
        │   ├── SessionSidebar.vue  # 左侧会话栏 + 主题切换
        │   ├── MessageList.vue     # 虚拟列表（DynamicScroller）
        │   ├── MessageItem.vue     # 单条消息气泡
        │   ├── MessageInput.vue    # 输入框（含语音按钮）
        │   └── TopicPrompts.vue    # 话题引导
        ├── views/
        │   ├── ChatView.vue        # 主对话视图
        │   └── AboutView.vue       # 关于页
        └── assets/
            └── main.css            # 全局样式 + 3 套主题变量
```

---

## 五、本地运行

### 0. 申请 API Key

访问 [讯飞 MaaS 控制台](https://training.xfyun.cn/modelService) → 注册 → 实名认证 → 创建应用 → 复制 APIKey 和 APISecret，用 `:` 拼成 `APIKey:APISecret`。

也可以用任何 OpenAI 兼容接口（DeepSeek / Moonshot / OpenRouter 等），改 `mindtree-backend/index.js` 里的 `hostname`、`path`、`MODEL`。

### 1. 启动后端

```bash
cd mindtree-backend
npm install
cp .env.example .env
# 编辑 .env 填入 API Key
npm run dev
```

### 2. 启动前端

**另开一个终端：**

```bash
cd mindtree-frontend
npm install
npm run dev
```

访问 [http://localhost:5173](http://localhost:5173)

### 3. 体验各项功能

- **语音输入**：点击输入框右侧的 🎙 按钮（需 Chrome/Edge + 授权麦克风）
- **主题切换**：左下角 🌿 / 🌙 / ☀️ 按钮
- **多会话**：左上"开启新对话"
- **停止生成**：AI 回答中点击右下角停止按钮
- **虚拟列表效果**：连续发 100+ 条消息，滚动依然流畅

---

## 六、智能心理对话研究系统（MindTree）

> 基于大语言模型的智能心理陪伴对话研究系统，支持多轮上下文管理、流式输出、语音输入及历史对话回溯。探索自然语言交互在心理健康服务中的应用潜力。
>
> **技术栈**：Vue 3 · Vite · Pinia · Vue Router · SSE · Web Speech API · highlight.js · vue-virtual-scroller
>
> **主要工作**：
>
> - 搭建 Vue 3 + Vite 模块化工程，采用组合式 API 将对话业务（`useChat`）、滚动控制（`useAutoScroll`）、语音识别（`useSpeechRecognition`）拆分为独立 composable，实现业务解耦与高复用
> - 封装 LLM API 模块，基于 `fetch + ReadableStream + TextDecoder` 手动解析 SSE，结合 50ms 节流批量更新和 `AbortController` 中断机制，实现稳定的流式对话体验；修复了 LLM 偶发将回复裹在代码块内导致 Markdown 渲染失效的隐藏问题
> - 基于 Pinia + `Map<sessionId, Session>` 构建多会话管理，配合 localStorage 防抖持久化，实现会话切换、重命名、删除的 O(1) 操作和崩溃恢复
> - 集成 vue-virtual-scroller 的 DynamicScroller 实现动态高度虚拟列表，通过 `size-dependencies` 解决流式追加时的高度测量问题，百条消息场景下 DOM 节点数保持在几十个以内，滚动稳定 60 FPS
> - 基于 Web Speech API 封装语音输入模块，实现低延迟的实时转写、中间结果预览、权限与网络错误分类处理，对比了 MediaRecorder + 后端 ASR 方案，综合延迟和部署成本选型
> - 使用 marked + DOMPurify 构建安全 Markdown 渲染管线，配合 highlight.js 按需注册语言实现代码高亮，通过白名单策略防御提示词注入导致的 XSS 风险
> - 基于 CSS 变量 + `[data-theme]` 属性选择器实现 3 套主题切换，纯 CSS 无运行时开销；结合 `defineAsyncComponent + Suspense` 优化路由切换体验

## 七、后续可做的改进

- [ ] 情绪打分 + 周趋势图（Chart.js）
- [ ] 危机词本地匹配，命中后主动弹出求助资源
- [ ] 长会话上下文摘要压缩（滑动窗口 / 累进式摘要）
- [ ] PWA 离线支持

---

## 八、免责声明

⚠ 本项目是一个情绪陪伴的研究 Demo，**不能替代**专业心理咨询或精神科医疗。

---

## License

MIT

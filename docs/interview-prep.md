# 智语心聊 MindTree 面试准备与补课路线

这份文档只服务一个目标：让你能真实、清楚、可追问地讲这个项目。不要把它当背诵稿，要对照代码一段一段看懂。

## 项目真实定位

智语心聊，英文名 MindTree，是一个个人完成的 AI 情绪陪伴对话项目，不是企业级商业系统。它的价值不在页面数量，而在几个具体技术链路：

- 前端用 Vue 3 + Pinia 管理多会话和流式消息。
- 后端用 Node 原生 http 模块代理大模型接口，统一注入心理陪伴 System Prompt。
- 前后端之间用 SSE 风格的流式响应，前端用 ReadableStream 手动解析。
- AI 回复支持 Markdown 渲染、代码高亮和 DOMPurify XSS 防护。
- 长消息列表用 vue-virtual-scroller 做动态高度虚拟滚动。
- 危机表达会触发本地求助提示，后端也会加强安全回应约束。
- 输入区处理了中文输入法、停止生成、语音输入和错误兜底。

面试中可以说“我独立完成了主要前后端功能”，不要说“前端负责人”“企业级系统”“已大规模上线”。

## 一句话介绍

这是一个基于大语言模型的情绪陪伴对话项目，前端负责多会话、流式渲染、Markdown 安全渲染、语音输入和危机提示，后端负责模型接口代理、System Prompt 注入、危机回应约束和 SSE 流转发。

## 腾讯面试当天版本

### 60 秒项目介绍

面试开场可以这样说：

> 我这个项目叫智语心聊 、MindTree，是一个 Vue3 + Node.js 做的情绪支持对话个人项目。它不是企业级商业系统，我主要用它把前端对话产品里的几个关键链路完整做了一遍：多会话状态管理、流式回复渲染、Markdown 安全渲染、停止生成后端代理模型接口，以及危机表达提示。
>
> 前端用 Vue3、Pinia 和 Vite。用户发送消息后，我会先把用户消息和一条空的 assistant 消息写进 store，然后通过 fetch 请求后端。前端用 ReadableStream 读取后端转发的 SSE 数据，用 TextDecoder 解码，再按 `data:` 解析增量内容。因为模型 token 返回比较频繁，我没有每来一个 token 就立即写入页面，而是用 buffer 加节流批量更新，降低渲染频率。
>
> 后端用 Node 原生 http/https 做了一个代理层，主要是为了保护 API Key、统一注入 System Prompt、处理跨域和错误，并把上游模型流式响应转发给浏览器。这个项目规模不大，但从输入、请求、流解析、状态更新到页面渲染这条链路，我都能按代码讲清楚。

这段话的重点是：承认个人项目，不装团队项目；强调完整链路；不说“大型”“企业级”“高并发”。

### 面试官问项目小怎么办

如果面试官说“你这个项目好像页面不多”，可以这样答：

> 是的，这个项目页面数量不多，主要是一个对话主页面和一个说明页面。我没有把它包装成复杂后台系统。它的重点不在路由数量，而是在对话类产品的核心链路：流式响应怎么解析、流式内容怎么更新到状态、长消息列表怎么渲染、AI 输出 Markdown 怎么做安全处理、用户停止生成时怎么取消请求，以及 API Key 为什么要放在后端代理里。

如果继续追问“那它有什么技术难点”，可以这样答：

> 对我来说最核心的是流式链路。普通请求是一次性拿完整 JSON，但对话产品需要边生成边展示，所以前端要处理 ReadableStream、SSE 分包、中文跨 chunk 解码、`[DONE]` 结束标识，以及增量内容和 Vue 状态更新之间的节奏控制。

如果再追问“这算优化吗”，可以这样答：

> 我不会把它说成很高级的性能优化，它更准确地说是一个体验和渲染频率控制。模型返回 token 的频率可能比较高，如果每个 chunk 都立刻写 Pinia，Vue 会频繁触发依赖更新和组件重渲染。我的处理是先把增量内容放进局部 buffer，然后每 50ms 合并写一次 assistant 消息，减少状态提交次数。

### 面试官问是不是自己做的

可以直接说：

> 是个人项目，我参考过一些对话产品的交互形态，也用工具辅助过开发，但核心链路我已经逐段过了一遍。现在能讲清楚的部分我会写在简历里，讲不清楚的不会包装成亮点。

这句话比硬说“全部从零手写”更稳。面试官真正看重的是你能不能解释清楚，以及你有没有夸大。

### 面试官问为什么要后端

第一层：

> 因为前端不能直接请求大模型接口。API Key 如果写在浏览器代码里，打包后会暴露，任何人都能在 DevTools 或请求里看到。

第二层：

> 所以后端做了代理。浏览器只请求我自己的 `/api/chat`，后端从环境变量读取 API Key，再去请求模型服务。这样密钥不会下发到浏览器。

第三层：

> 后端还负责统一注入 System Prompt、做消息格式校验、处理 CORS、把上游 SSE 流转发给前端。如果用户点击停止生成，前端 AbortController 会中断请求，后端监听连接关闭后销毁上游请求，避免继续占用资源。

### 面试官问流式响应

第一层：

> 流式响应就是后端不是等模型完整生成完再返回，而是模型生成一点就返回一点，前端边接收边展示。

第二层：

> 前端用 `fetch` 拿到响应后，不直接 `response.json()`，而是从 `response.body.getReader()` 里循环读取 chunk。chunk 是二进制数据，所以用 `TextDecoder` 解码成字符串。

第三层：

> chunk 边界不等于业务边界，一条 SSE 数据可能被拆成两段，所以我维护了一个字符串 buffer。每次新 chunk 进来先追加到 buffer，然后按 `\n\n` 切分完整事件，只解析完整的 `data:` 内容，剩下不完整的继续留在 buffer 里等下一个 chunk。

### 面试官问 TextDecoder 的 stream 参数

可以这样答：

> UTF-8 中文字符可能跨 chunk 被拆开。如果每次都独立 decode，半个中文字符可能被解析成乱码。`TextDecoder.decode(value, { stream: true })` 会保留未完成的字节序列，等下一个 chunk 到了再一起解码，所以更适合处理流式文本。

### 面试官问为什么 Vue diff 还需要节流

第一层：

> Vue diff 能减少真实 DOM 更新，但它不能消除每次状态变更带来的响应式触发、组件更新调度和虚拟 DOM 计算。

第二层：

> 流式回复里 assistant 消息内容每次都变，文本节点确实需要更新。如果 token 很密集，每个 token 都写状态，更新频率会很高。

第三层：

> 所以我把频繁 token 更新合并成较低频率的状态提交。这个思路不是替代 Vue diff，而是减少进入 Vue 更新流程的次数。

### 面试官问 Markdown 安全

第一层：

> AI 回复支持 Markdown，所以页面里需要把 Markdown 转成 HTML。

第二层：

> 但 Vue 的 `v-html` 会直接插入 HTML，如果内容里混入 script、事件属性或者危险链接，就有 XSS 风险。

第三层：

> 所以我不是直接渲染 marked 的结果，而是用 DOMPurify 做白名单清洗，只保留安全标签和必要 class，再交给 `v-html` 渲染。

### 面试官问 Pinia 状态设计

第一层：

> 我把会话和消息放到 Pinia 里，因为多个组件都要访问：侧边栏需要会话列表，消息列表需要当前会话消息，输入区发送后要更新当前会话。

第二层：

> 会话内部用 Map 存储，按 sessionId 快速读写。展示列表时再通过 computed 派生成数组。

第三层：

> 持久化到 localStorage 时不能直接存 Map，所以会把 Map 转成数组再 JSON.stringify。恢复时再从数组还原成 Map。

### 面试官问危机提示

第一层：

> 因为项目场景是情绪支持，我加了危机表达检测，比如用户提到轻生、自伤等高风险词时，前端会展示求助提示。

第二层：

> 这个检测不是医疗诊断，也不能替代专业干预。它只是一个安全兜底：提醒用户联系身边的人、紧急服务或心理援助热线。

第三层：

> 后端也会基于最后一条用户消息做二次识别，如果命中风险表达，就额外注入安全回应 Prompt，要求模型优先确认安全、避免给出危险细节。

### 面试官问不会 React / Vue2

可以这样答：

> 我目前主力是 Vue3，这个项目也是围绕 Vue3 做的。Vue2 和 React 我还在系统补，所以不会把它们写成已熟练掌握。短期我会先把 JS 基础、Vue 响应式、组件通信、状态管理和工程化理解扎实，再补 React 的组件模型、Hooks 和状态管理。

不要说“我很快就能上手”。面试官更愿意听到你知道自己的边界。

### 面试官问你为什么适合 28 届实习

可以这样答：

> 我现在的优势不是项目规模很大，而是学校和专业背景还可以，学习时间也比较充足。我已经意识到项目不能靠包装，必须能讲清楚，所以最近在把这个项目的流式请求、状态管理、后端代理和安全渲染逐段吃透。作为 28 届实习生，我希望先从基础业务和组件开发做起，同时补齐 React、Vue2、Node 和工程化。

### 面试当天不要说的话

- 不说“这是企业级项目”。
- 不说“我是前端负责人”。
- 不说“React、Vue2 也会一点”，除非能写代码并解释差异。
- 不说“这个项目已经上线”，除非真的有公网地址。
- 不说“用了 AI，所以我也不太清楚”，应该说“有工具辅助，但我已经逐段理解核心链路”。
- 不把节流、axios 封装、页面样式写成高级亮点。

## 核心链路

用户发送一条消息后的完整流程：

1. `MessageInput.vue` 处理输入框、Enter 发送、中文输入法 composition 事件。
2. `ChatView.vue` 接收 `send` 事件，调用 `useChat().sendMessage(text)`。
3. `useChat.js` 先把用户消息写入 Pinia，再插入一条空的 assistant 消息作为流式占位。
4. `streamChat()` 用 `fetch` 请求后端 `/api/chat`，传入 `AbortController.signal`。
5. 前端用 `analyzeCrisisText()` 检测用户输入，命中危机表达时展示求助提示。
6. 后端 `index.js` 校验消息，注入 System Prompt；如果最近一条用户消息命中危机词，再注入安全回应 Prompt。
7. 后端调用讯飞 OpenAI 兼容接口。
8. 上游模型返回流式数据，后端用 `upstreamRes.pipe(res)` 转发给浏览器。
9. 前端用 `response.body.getReader()` 读取二进制 chunk。
10. `TextDecoder.decode(value, { stream: true })` 处理 UTF-8 跨 chunk 字符。
11. 前端按 `\n\n` 切分 SSE event，解析 `data:` 行，取 `choices[0].delta.content`。
12. `useChat.js` 把 token 先放进 buffer，再用 50ms throttle 批量写入最后一条 assistant 消息。
13. Pinia 状态变化触发 `MessageList.vue` 更新，虚拟列表重新测量当前消息高度。
14. 回复结束后落盘到 localStorage，刷新页面可以恢复会话。

## 必须搞懂的项目知识

### Vue 3

- `ref` 和 `reactive` 的区别。
- `computed` 为什么适合派生当前会话消息和会话列表。
- `watch` 的作用，为什么消息变化后要滚到底部。
- `<script setup>` 的编译含义，`defineProps`、`defineEmits` 怎么用。
- 组件拆分：页面组装层、业务 composable、store、纯 UI 组件分别负责什么。
- Pinia setup store 写法，为什么状态和 action 放在同一个 store 里。
- Vue 响应式基础：Vue 3 用 Proxy 劫持对象读写，依赖收集后在 setter 触发更新。

### JavaScript

- 作用域、作用域链、闭包，闭包什么时候会导致内存不能释放。
- 原型链和构造函数，能画出对象查找属性的路径。
- `this` 的四种绑定：默认、隐式、显式、new。
- Promise 状态流转，`then` 回调为什么进微任务。
- 事件循环：同步任务、微任务、宏任务的执行顺序。
- 防抖和节流：本项目用的是节流，目的是降低流式 token 更新频率。
- `AbortController` 如何取消 fetch，请求取消和业务失败有什么区别。
- `TextDecoder` 的 `stream: true` 为什么能避免中文乱码。

### HTTP / SSE / 流式响应

- HTTP 请求和响应由请求行、请求头、请求体、响应状态码、响应头、响应体组成。
- SSE 的基本格式是多行文本，常见数据行为 `data: xxx`，事件之间用空行分隔。
- `fetch` 默认不是一次性等完整响应，`response.body` 可以作为 ReadableStream 读取。
- chunk 边界不是业务边界，一条 JSON 可能被切成两块，所以前端需要 `buffer`。
- `[DONE]` 是 OpenAI 风格的流结束标识，不是浏览器协议自带的。
- 后端转发流时要设置 `Content-Type: text/event-stream` 和 `Cache-Control: no-cache`。

### Node 后端

- 为什么前端不能直接带 API Key 请求模型接口：密钥会暴露在浏览器。
- 后端代理的职责：保护密钥、注入 System Prompt、统一错误处理、处理跨域。
- CORS 是浏览器同源策略导致的跨域限制，后端要返回允许来源。
- `.env` 存放敏感配置，`.env.example` 只放示例。
- `req.on('data')` 和 `req.on('end')` 是 Node 原生处理请求体的方式。
- `https.request` 如何设置 hostname、path、method、headers 和 timeout。
- `res.on('close')` 可以感知客户端断开，及时销毁上游请求。

### 安全与浏览器能力

- `v-html` 有 XSS 风险，所以 AI Markdown 渲染必须经过 DOMPurify。
- 白名单策略：允许必要标签和 class，禁止 script、iframe、onload 这类危险内容。
- 危机词检测不能替代专业干预，它只做风险提示和安全边界收紧。
- 危机提示做了前后端两层：前端即时提示用户求助，后端约束模型优先确认安全。
- localStorage 只能存字符串，所以 Map 持久化前要转成数组。
- Web Speech API 是浏览器能力，兼容性有限，Firefox 不支持时要降级隐藏。
- 中文输入法组合中按 Enter 不能直接发送，要用 composition 事件判断。

### 性能与体验

- 流式 token 每来一次都写状态会频繁触发渲染，所以用 throttle 批量刷入。
- 长列表全量渲染会让 DOM 数量随消息数增长，虚拟列表只保留视口附近节点。
- 动态高度虚拟列表要知道内容变化后重新测量，所以用了 `size-dependencies`。
- 自动滚动不能无脑滚到底，用户上翻历史时要尊重当前位置。

### 部署

- `npm run build` 会生成 `dist` 静态资源。
- 前端可以部署到 Vercel、Netlify、Nginx 或任意静态服务器。
- 后端要单独运行 Node 服务，并配置真实的 `XUNFEI_API_KEY`。
- 生产环境前端不能请求 `localhost:3000`，要用 `VITE_API_BASE_URL` 指向后端域名，或用 Nginx 把 `/api` 反向代理到后端。
- 域名解析负责把域名指向服务器 IP，HTTPS 证书负责浏览器安全连接。

## 面试可以重点讲的 5 个点

1. 流式响应解析：ReadableStream、TextDecoder、SSE buffer、`[DONE]`。
2. 流式渲染性能：token buffer + 50ms throttle，减少频繁 DOM 更新。
3. 多会话状态管理：Pinia + Map + localStorage 防抖持久化。
4. Markdown 安全渲染：marked + highlight.js + DOMPurify，解释为什么 `v-html` 需要防护。
5. 停止生成：前端 AbortController，后端监听 close 后销毁上游请求。
6. 危机表达检测：本地求助提示 + 后端安全 Prompt，不把安全完全交给模型。

## 不要这样说

- 不要说这是企业级项目。
- 不要说自己是前端负责人。
- 不要说“零延迟”“稳定 60 FPS”这种没有压测数据支撑的话。
- 不要说完全懂心理咨询专业，只说“用 prompt 约束 AI 不做诊断，并提供免责声明和求助提醒”。
- 不要说 React、Vue2、Node 工程化都很熟，除非你已经能写项目并解释原理。

## 一周冲刺安排

### 第 1 天：跑通和画图

- 本地分别启动前后端。
- 画出“发送消息到流式渲染”的链路图。
- 对照本文“核心链路”把每一步代码位置标出来。
- 修掉 README、环境变量、错误处理等明显硬伤。

### 第 2 天：吃透流式请求

- 手写一遍 `fetch + response.body.getReader()` 的最小 demo。
- 解释为什么要 `buffer.split('\n\n')`。
- 解释为什么 `TextDecoder` 要用 `stream: true`。
- 准备 2 分钟讲清楚 SSE 的回答。

### 第 3 天：吃透 Pinia 和 Vue

- 讲清楚 `sessions` 为什么用 Map。
- 讲清楚 `activeMessages` 和 `sessionList` 为什么用 computed。
- 能回答 Vue3 响应式、组件通信、生命周期、watch、computed。
- 把 `MessageInput`、`MessageList`、`MessageItem` 的职责说清楚。

### 第 4 天：吃透后端和部署

- 讲清楚为什么要后端代理。
- 讲清楚 CORS、环境变量、API Key 保护。
- 至少把前端部署到一个静态平台，或明确写出 Nginx 部署步骤。
- 能说清生产环境接口地址怎么配置。

### 第 5 天：补 JS 高频基础

- 闭包、原型链、this、Promise、事件循环。
- 防抖/节流手写。
- localStorage、cookie、sessionStorage 区别。
- 跨域和 CORS。

### 第 6 天：模拟项目追问

- 录音回答“项目介绍”“最难点”“性能优化”“安全问题”“部署方案”。
- 每个回答都必须能指到具体文件和代码。
- 不会的问题写成“我目前怎么理解、后续怎么补”，不要硬编。

### 第 7 天：简历和最终演练

- 简历只保留能讲清楚的点。
- 项目经历控制在 4-5 条，不堆十几个亮点。
- 做 2 次完整模拟面试：一次讲项目，一次问基础。

## 简历项目描述建议

可以写：

> 智语心聊 MindTree 智能情绪陪伴对话系统 | Vue3 + Pinia + Node.js
>
> - 基于 Vue3 + Vite 搭建前端工程，使用 Pinia 管理多会话状态，通过 Map 存储会话并配合 localStorage 防抖持久化，实现会话创建、切换、重命名与恢复。
> - 封装 LLM 流式请求模块，基于 fetch ReadableStream 手动解析 SSE 数据，使用 TextDecoder 处理中文跨 chunk 解码，并结合 50ms 节流降低流式渲染更新频率。
> - 使用 Node.js 后端代理大模型接口，统一注入心理陪伴 System Prompt，并通过 AbortController + `res.close` 处理用户主动停止生成的资源释放。
> - 使用 marked + DOMPurify 实现 AI 回复的 Markdown 安全渲染，并接入 highlight.js 按需注册语言实现代码块高亮。
> - 集成 vue-virtual-scroller 渲染动态高度消息列表，结合底部跟随状态判断，避免用户查看历史消息时被强制滚回底部。
> - 针对情绪陪伴场景增加危机表达检测，前端命中风险词时展示求助提示，后端二次识别并追加安全回应提示词，避免完全依赖模型自行判断。

不要再写“前端负责人”。如果面试官问团队，就说这是个人项目，主要用于训练完整前后端链路和流式对话体验。

# 智语心聊 MindTree 代码讲解与练习

这份文档用来按模块吃透项目。学习顺序是：入口和路由、页面、组件、状态、请求、后端、工具函数。每一节都要做到三件事：能说清职责、能画出数据流、能独立做一个小练习。

## VS Code 双栏阅读方式

你可以把 VS Code 变成“左边讲解，右边源码”的阅读模式：

1. 左边打开本文档 `docs/code-walkthrough.md`。
2. 按 `Command + \` 把编辑器分成左右两栏。
3. 左边保留本文档，右边打开对应源码文件。
4. 阅读每一节时，先看“职责”，再切到右边看源码，最后做“小练习”。

推荐顺序：

| 学习节 | 右边打开的源码 |
| --- | --- |
| 入口 | [`main.js`](../mindtree-frontend/src/main.js) |
| 根组件 | [`App.vue`](../mindtree-frontend/src/App.vue) |
| 路由 | [`router/index.js`](../mindtree-frontend/src/router/index.js) |
| 主聊天页 | [`ChatView.vue`](../mindtree-frontend/src/views/ChatView.vue) |
| 关于页 | [`AboutView.vue`](../mindtree-frontend/src/views/AboutView.vue) |
| 侧边栏 | [`SessionSidebar.vue`](../mindtree-frontend/src/components/SessionSidebar.vue) |
| 消息列表 | [`MessageList.vue`](../mindtree-frontend/src/components/MessageList.vue) |
| 单条消息 | [`MessageItem.vue`](../mindtree-frontend/src/components/MessageItem.vue) |
| 输入框 | [`MessageInput.vue`](../mindtree-frontend/src/components/MessageInput.vue) |
| 起始话题 | [`TopicPrompts.vue`](../mindtree-frontend/src/components/TopicPrompts.vue) |
| 危机提示 | [`CrisisNotice.vue`](../mindtree-frontend/src/components/CrisisNotice.vue) 和 [`crisis.js`](../mindtree-frontend/src/utils/crisis.js) |
| 聊天状态 | [`stores/chat.js`](../mindtree-frontend/src/stores/chat.js) |
| 发送流程 | [`useChat.js`](../mindtree-frontend/src/composables/useChat.js) |
| 网络请求 | [`api/chat.js`](../mindtree-frontend/src/api/chat.js) |
| Markdown 安全渲染 | [`markdown.js`](../mindtree-frontend/src/utils/markdown.js) |
| 节流函数 | [`throttle.js`](../mindtree-frontend/src/utils/throttle.js) |
| 后端 | [`mindtree-backend/index.js`](../mindtree-backend/index.js) |

如果你想打开 Markdown 预览，可以按 `Command + Shift + V`。但学习源码时更建议直接看 Markdown 原文，因为链接和代码路径更方便复制。

## 0. 总体框架

项目分成前端和后端两部分：

- `mindtree-frontend`：Vue 3 单页应用，负责页面、会话状态、消息输入、流式渲染、Markdown 安全渲染、语音输入和危机提示。
- `mindtree-backend`：Node.js 服务，负责 API Key 保护、模型接口代理、System Prompt 注入、SSE 流式转发、CORS 和错误处理。

前端内部可以按这一层理解：

```text
main.js
  -> App.vue
    -> router/index.js
      -> ChatView.vue
        -> SessionSidebar.vue
        -> MessageList.vue
          -> MessageItem.vue
        -> TopicPrompts.vue
        -> CrisisNotice.vue
        -> MessageInput.vue

ChatView.vue
  -> useChat.js
    -> api/chat.js
    -> stores/chat.js
    -> utils/throttle.js

组件
  -> stores/chat.js
  -> stores/preferences.js
  -> utils/markdown.js
  -> utils/crisis.js
```

面试时可以说：

> 这个项目不是简单把所有逻辑写在一个页面里，而是按页面、组件、业务 composable、store、api、utils 分层。页面负责组织组件，组件负责展示和交互，store 管状态，api 管网络请求，composable 管一段可复用业务流程。

小练习：

1. 画一张项目结构图，不看本文也能说出每个目录负责什么。
2. 新建一个最小 Vue 项目，写出 `main.js -> App.vue -> router -> 两个页面` 的结构。
3. 用自己的话解释：为什么不把请求、状态、页面交互全部写在 `ChatView.vue` 里。

## 1. 入口：main.js

文件：`mindtree-frontend/src/main.js`

职责：

- 创建 Vue 应用。
- 注册 Pinia。
- 注册 Vue Router。
- 引入全局样式。
- 挂载到 `index.html` 里的 `#app`。

核心代码：

```js
const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

要懂的问题：

- `createApp(App)` 创建的是整个前端应用实例。
- `app.use(createPinia())` 让所有组件都可以使用 Pinia store。
- `app.use(router)` 让 `<router-view>`、`<router-link>` 和路由跳转可用。
- `app.mount('#app')` 把 Vue 接管到真实 DOM 节点上。

小练习：

1. 手写一个只有 `main.js + App.vue` 的 Vue 应用。
2. 加一个 Pinia store，在任意组件里显示一个计数器。
3. 加 Vue Router，做 `/home` 和 `/about` 两个页面。

## 2. 根组件：App.vue

文件：`mindtree-frontend/src/App.vue`

职责：

- 承载路由页面。
- 初始化聊天 store，从 localStorage 恢复会话。
- 给异步路由组件提供 loading 状态。

关键点：

```js
onMounted(() => {
  store.hydrate()
})
```

`hydrate()` 的意思是“水合/恢复”。这里不是服务端渲染里的 hydrate，而是从浏览器本地存储恢复历史会话。

模板里的结构：

```vue
<router-view v-slot="{ Component }">
  <transition name="fade" mode="out-in">
    <Suspense>
      <component :is="Component" />
    </Suspense>
  </transition>
</router-view>
```

要懂的问题：

- `router-view` 根据当前 URL 决定渲染哪个页面。
- `Suspense` 用于等待异步组件加载。
- `transition` 给页面切换加淡入淡出。
- `component :is="Component"` 是动态组件写法。

小练习：

1. 写一个根组件，进入页面时从 localStorage 读取用户名并展示。
2. 做两个异步路由页面，切换时显示 loading。
3. 不用 `router-view`，手写一个 `currentPage` 动态组件切换，理解动态组件原理。

## 3. 路由：router/index.js

文件：`mindtree-frontend/src/router/index.js`

职责：

- 定义前端页面路径。
- `/` 重定向到 `/chat`。
- `/chat` 对应主聊天页。
- `/about` 对应项目说明页。

关键代码：

```js
const ChatView = () => import('@/views/ChatView.vue')
const AboutView = () => import('@/views/AboutView.vue')
```

这里用的是路由懒加载。访问对应页面时才加载页面代码。

要懂的问题：

- `createWebHistory()` 使用浏览器 history 模式。
- history 模式上线时需要服务器兜底返回 `index.html`，否则刷新 `/about` 可能 404。
- `redirect` 表示路径重定向。
- `name` 可以用于编程式跳转。

小练习：

1. 给项目临时加一个 `/practice` 页面，显示“练习页”。
2. 用 `router.push('/chat')` 实现按钮跳转。
3. 解释 history 模式和 hash 模式的区别。

## 4. 主页面：ChatView.vue

文件：`mindtree-frontend/src/views/ChatView.vue`

职责：

- 组织聊天页的整体布局。
- 管理侧边栏折叠状态。
- 接收话题选择，把内容预填到输入框。
- 接收发送事件，做危机检测，然后调用 `sendMessage`。
- 展示全局错误和危机提示。

核心数据：

```js
const sidebarCollapsed = ref(window.innerWidth < 768)
const prefill = ref('')
const crisis = ref(null)
```

核心流程：

```js
function handleSend(text) {
  prefill.value = ''
  crisis.value = analyzeCrisisText(text)
  sendMessage(text)
}
```

这说明 `ChatView` 不直接处理网络请求，它只是页面协调层。真正的发送逻辑在 `useChat.js`。

组件关系：

- `SessionSidebar`：会话列表。
- `MessageList`：消息列表。
- `CrisisNotice`：危机提示。
- `TopicPrompts`：起始话题。
- `MessageInput`：输入框。

面试时可以说：

> `ChatView` 是页面组装层，不直接写请求细节。用户输入从 `MessageInput` emit 到 `ChatView`，`ChatView` 做危机检测和状态协调，再调用 `useChat` 里的发送流程。

小练习：

1. 写一个 `TodoView`，里面组合 `TodoList`、`TodoInput`、`TodoFilter` 三个组件。
2. 让 `TodoInput` 通过 `emit('add', text)` 把数据传给页面。
3. 页面收到事件后不直接操作 DOM，而是调用一个 `useTodo()` composable。

## 5. 关于页：AboutView.vue

文件：`mindtree-frontend/src/views/AboutView.vue`

职责：

- 展示项目定位、安全说明、主要能力和技术实现。
- 提供回到聊天页的按钮。

关键点：

```js
const router = useRouter()
```

按钮点击：

```vue
@click="router.push('/chat')"
```

要懂的问题：

- `useRouter()` 拿到路由实例，用来跳转。
- `useRoute()` 拿的是当前路由信息，比如路径、参数、query。
- 说明页没有复杂状态，所以不需要 Pinia。

小练习：

1. 写一个 `/profile` 页面，点击按钮回到 `/chat`。
2. 在 `/profile?id=123` 中用 `useRoute()` 读取 query。
3. 解释什么时候用 `<router-link>`，什么时候用 `router.push()`。

## 6. 侧边栏：SessionSidebar.vue

文件：`mindtree-frontend/src/components/SessionSidebar.vue`

职责：

- 展示会话列表。
- 新建会话。
- 切换会话。
- 删除会话。
- 重命名会话。
- 切换主题。
- 跳转到关于页。

用到的状态：

```js
const store = useChatStore()
const prefs = usePreferencesStore()
```

为什么这里直接用 store：

- 侧边栏是会话管理入口。
- 多个页面操作都围绕同一个全局会话状态。
- 如果通过层层 props 传递，会让父组件过度臃肿。

关键交互：

- 新建：`store.createSession()`
- 切换：`store.switchSession(id)`
- 删除：`store.deleteSession(id)`
- 重命名：`store.renameSession(id, title)`
- 主题：`prefs.setTheme(t.id)`

要懂的问题：

- 为什么删除按钮要 `e.stopPropagation()`：防止点击删除时同时触发外层会话切换。
- 为什么生成中禁用新建和删除当前会话：避免流式请求还在写入时 active session 变化。
- 为什么重命名用本地 `renamingId` 和 `renameBuf`：这是组件内部 UI 状态，不需要全局共享。

小练习：

1. 做一个极简会话列表：新建、切换、删除。
2. 给列表项加重命名功能，要求 Enter 保存、Esc 取消、blur 保存。
3. 写一个按钮在点击子元素时不触发父元素点击，练习 `stopPropagation`。

## 7. 消息列表：MessageList.vue

文件：`mindtree-frontend/src/components/MessageList.vue`

职责：

- 展示当前会话的所有消息。
- 使用虚拟列表减少长消息列表 DOM 数量。
- 当前消息变化时自动滚动到底部。
- 判断最后一条 assistant 消息是否正在流式输出。

核心组件：

```vue
<DynamicScroller>
  <DynamicScrollerItem>
    <MessageItem />
  </DynamicScrollerItem>
</DynamicScroller>
```

为什么用虚拟列表：

- 普通列表会把所有消息都渲染成 DOM。
- 消息很多、内容很长时，DOM 数量和布局计算成本会增加。
- 虚拟列表只渲染视口附近的内容。

关键点：

```vue
:size-dependencies="[item.content]"
```

这表示消息内容变化时，动态高度需要重新测量。流式输出时 assistant 内容一直变，所以这个依赖很重要。

小练习：

1. 写一个普通 `v-for` 消息列表。
2. 加一个按钮一次插入 1000 条消息，观察页面卡顿。
3. 用虚拟列表或自己写一个简化版“只渲染前 30 条”的列表，理解为什么需要虚拟化。

## 8. 单条消息：MessageItem.vue

文件：`mindtree-frontend/src/components/MessageItem.vue`

职责：

- 区分用户消息和 AI 消息。
- 用户消息按纯文本展示。
- AI 消息按 Markdown 渲染。
- 正在生成且内容为空时显示思考占位。
- 正在生成且已有内容时显示光标。

关键判断：

```js
const isUser = computed(() => props.message.role === 'user')
```

为什么用户消息不渲染 Markdown：

- 用户输入可能包含 `*`、`#`、HTML 片段。
- 如果直接走 Markdown + HTML，可能产生不符合预期的格式。
- 用户消息只需要保留换行，纯文本更安全。

为什么 AI 消息要 DOMPurify：

- Markdown 会转成 HTML。
- `v-html` 会直接插入 HTML。
- 必须过滤危险标签和属性，降低 XSS 风险。

小练习：

1. 写一个 `MessageItem`，根据 `role` 显示左右气泡。
2. 实现“空 assistant 消息显示三个点”。
3. 写一个最小 Markdown 渲染 demo，先不加 DOMPurify，再解释为什么有风险。

## 9. 输入框：MessageInput.vue

文件：`mindtree-frontend/src/components/MessageInput.vue`

职责：

- 维护输入框文本。
- Enter 发送，Shift + Enter 换行。
- 处理中文输入法组合输入。
- 支持语音输入。
- 根据生成状态显示发送按钮或停止按钮。
- 根据外部传入 `prefill` 预填内容。

核心交互：

```js
function handleSend() {
  const content = text.value.trim()
  if (!content || store.isGenerating) return
  emit('send', content)
  text.value = ''
}
```

中文输入法处理：

```js
let isComposing = false
function onCompositionStart() { isComposing = true }
function onCompositionEnd() { isComposing = false }
```

为什么需要这个：

- 中文输入法选词时也可能按 Enter。
- 如果不判断 composition 状态，会在用户还没完成输入时直接发送。

小练习：

1. 写一个 textarea，Enter 发送，Shift + Enter 换行。
2. 加 `compositionstart` 和 `compositionend`，测试中文输入法选词。
3. 实现输入框高度随内容增长，最高 140px。

## 10. 起始话题：TopicPrompts.vue

文件：`mindtree-frontend/src/components/TopicPrompts.vue`

职责：

- 页面初始状态下展示几个话题按钮。
- 从后端 `/api/topics` 获取提示文本。
- 用户点击后，把提示文本 emit 给父组件。

关键逻辑：

```js
const shouldShow = computed(() => store.activeMessages.length <= 1)
```

为什么长度小于等于 1 才展示：

- 新会话默认只有一条欢迎语。
- 一旦用户开始对话，就不再展示起始话题，避免干扰聊天。

小练习：

1. 写一个“快捷输入”组件，点击按钮把文本传给父组件。
2. 把快捷选项从本地数组改成接口获取。
3. 只在列表为空时展示快捷选项。

## 11. 危机提示：CrisisNotice.vue 和 crisis.js

文件：

- `mindtree-frontend/src/components/CrisisNotice.vue`
- `mindtree-frontend/src/utils/crisis.js`

职责：

- `crisis.js` 判断用户输入是否命中风险表达。
- `CrisisNotice.vue` 展示求助提示和紧急联系电话。

要注意的边界：

- 这不是医疗诊断。
- 不能承诺识别准确。
- 只是一个产品安全兜底。

面试时可以说：

> 危机检测在前端做即时提示，后端也做二次识别并注入安全 Prompt。前端提示负责及时性，后端 Prompt 负责约束模型回应边界。

小练习：

1. 写一个 `analyzeText(text)`，检测“退款、投诉、差评”等关键词并返回等级。
2. 根据等级展示不同颜色的提示卡片。
3. 把关键词数组拆到单独 utils 文件，不写死在组件里。

## 12. 聊天状态：stores/chat.js

文件：`mindtree-frontend/src/stores/chat.js`

职责：

- 保存全部会话。
- 保存当前会话 id。
- 保存是否正在生成。
- 提供会话增删改查。
- 提供消息追加和最后一条 AI 消息增量更新。
- 持久化到 localStorage。

核心状态：

```js
const sessions = reactive(new Map())
const activeId = ref(null)
const isGenerating = ref(false)
```

为什么 `sessions` 用 Map：

- 会话按 id 查找很频繁。
- Map 的 `get/set/delete/has` 语义清楚。
- 展示列表时再转数组排序。

为什么持久化要转数组：

```js
sessions: Array.from(sessions.entries())
```

因为 localStorage 只能存字符串，`JSON.stringify(new Map())` 不能得到想要的数据结构。

小练习：

1. 手写一个 Pinia store，维护 `Map<id, todoList>`。
2. 实现 `createList`、`switchList`、`deleteList`。
3. 把 Map 转数组存 localStorage，再从 localStorage 还原 Map。

## 13. 发送流程：composables/useChat.js

文件：`mindtree-frontend/src/composables/useChat.js`

职责：

- 管理一次发送消息的完整业务流程。
- 写入用户消息。
- 插入空 assistant 消息作为流式占位。
- 调用 `streamChat` 请求后端。
- 把流式 token 缓冲后写入最后一条 AI 消息。
- 处理停止生成、错误、结束状态。

核心流程：

```js
store.addMessage({ role: 'user', content: userText.trim() })
store.addMessage({ role: 'assistant', content: '' })
```

为什么先插入空 assistant：

- 页面可以立刻显示“思考中”状态。
- 后续流式内容只需要追加到最后一条 assistant 消息。
- 数据结构简单，不需要每个 token 新建一条消息。

节流逻辑：

```js
let buffer = ''
const flushBuffer = throttle(() => {
  if (buffer) {
    store.appendToLastAIMessage(buffer)
    buffer = ''
  }
}, 50)
```

小练习：

1. 写一个假流式函数，每 100ms 返回一个字。
2. 先每个字都更新页面，再改成 buffer + 节流。
3. 加一个“停止生成”按钮，用 AbortController 或定时器清理实现。

## 14. 网络请求：api/chat.js

文件：`mindtree-frontend/src/api/chat.js`

职责：

- 请求后端 `/api/chat`。
- 读取 `ReadableStream`。
- 解析 SSE 格式。
- 通过回调把增量内容交给业务层。
- 请求失败时提取错误信息。

核心逻辑：

```js
const reader = response.body.getReader()
const decoder = new TextDecoder()
```

为什么不用 `response.json()`：

- `response.json()` 要等完整响应结束。
- 流式对话需要边接收边展示。
- 所以要直接读 `response.body`。

为什么要 buffer：

```js
const events = buffer.split('\n\n')
buffer = events.pop() || ''
```

因为网络 chunk 边界不稳定。一条完整 SSE event 可能被拆开，最后一个不完整片段要留到下一次再解析。

小练习：

1. 写一个函数解析字符串：`data: {"text":"a"}\n\n data: [DONE]\n\n`。
2. 模拟一个 JSON 被拆成两半，验证 buffer 为什么必要。
3. 手写一个 `fetchStream(url, onChunk)`，用 `getReader()` 读取普通文本流。

## 15. 后端：mindtree-backend/index.js

文件：`mindtree-backend/index.js`

职责：

- 创建 HTTP 服务。
- 处理 CORS。
- 提供 `/health`、`/api/topics`、`/api/chat`。
- 校验前端传来的 messages。
- 注入系统提示词。
- 请求上游模型接口。
- 把上游流式响应 pipe 给前端。

核心接口：

- `GET /health`：健康检查。
- `GET /api/topics`：起始话题。
- `POST /api/chat`：聊天流式接口。

为什么后端不用 Express 也能做：

- Node 原生 `http.createServer` 就能拿到 `req` 和 `res`。
- `req.on('data')` 接收请求体。
- `req.on('end')` 表示请求体接收完。
- `https.request` 可以请求上游模型服务。

关键安全点：

- API Key 只在后端 `.env`，不下发到浏览器。
- 前端传来的 messages 要校验长度和 role。
- 遇到危机表达，后端额外注入安全 Prompt。
- 上游请求失败时通过 SSE 格式返回错误。

小练习：

1. 用 Node 原生 http 写一个 `/health` 接口。
2. 写一个 `POST /echo`，读取请求体并原样返回。
3. 写一个假 SSE 接口，每 500ms 返回一个 `data: xxx\n\n`。
4. 前端用 `fetch + getReader()` 读取这个假 SSE 接口。

## 16. 你要能讲出的完整链路

从用户点击发送开始：

1. `MessageInput.vue` 校验输入，emit `send`。
2. `ChatView.vue` 收到 `send`，先做危机检测，再调用 `useChat().sendMessage()`。
3. `useChat.js` 往 Pinia 写入用户消息和空 assistant 消息。
4. `useChat.js` 组装给模型的 messages，排除最后那条空 assistant。
5. `api/chat.js` 发起 fetch 请求 `/api/chat`。
6. `backend/index.js` 读取请求体，校验 messages。
7. 后端注入 System Prompt，如果命中危机词就再注入安全 Prompt。
8. 后端用 `https.request` 请求上游模型，并设置 `stream: true`。
9. 上游返回 SSE 流，后端 `upstreamRes.pipe(res)` 转发给前端。
10. 前端 `getReader()` 读取 chunk，`TextDecoder` 解码。
11. 前端按 `\n\n` 拆 SSE event，解析 `data:`。
12. 每个 delta 通过 `onChunk` 回到 `useChat.js`。
13. `useChat.js` 用 buffer + throttle 批量写入最后一条 assistant 消息。
14. Pinia 状态变化，`MessageList.vue` 和 `MessageItem.vue` 重新渲染。
15. 结束后 `onDone` 收尾，关闭生成状态并持久化。

小练习：

1. 把这 15 步手写到纸上。
2. 每一步旁边标一个文件名。
3. 随机遮住任意一步，自己补出上下游。

## 17. 一周内的学习节奏

第 1 天：

- 搞懂入口、路由、两个页面。
- 小练习：做一个两页面 Vue 小项目。

第 2 天：

- 搞懂 `ChatView`、组件通信、`emit`、`props`。
- 小练习：做一个 Todo 页面，输入组件向父组件传值。

第 3 天：

- 搞懂 Pinia、Map、computed、localStorage。
- 小练习：做一个多列表 Todo store。

第 4 天：

- 搞懂 `useChat`、流式占位消息、节流、停止生成。
- 小练习：做一个假流式打字机。

第 5 天：

- 搞懂 `api/chat.js` 的 ReadableStream、TextDecoder、SSE buffer。
- 小练习：手写一个 SSE parser。

第 6 天：

- 搞懂 Node 后端、CORS、请求体读取、上游转发。
- 小练习：写一个 Node 假 SSE 服务。

第 7 天：

- 串讲完整链路。
- 对照 `docs/interview-prep.md` 练项目追问。
- 把不会的点标出来，不要写进简历亮点。

## 18. 每天验收标准

不是“看完了”就算懂。每天要达到这些标准：

- 能不看文档说出这一层的职责。
- 能指出对应文件。
- 能解释一个关键实现为什么这样写。
- 能独立做出一个缩小版练习。
- 能回答“如果不这样写会有什么问题”。

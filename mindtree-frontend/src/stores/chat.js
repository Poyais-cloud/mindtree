/**
 * Chat Store —— 全局对话状态管理
 */
import { defineStore } from 'pinia'
import { reactive, ref, computed } from 'vue'

const STORAGE_KEY = 'mindtree_sessions_v1'

// ========== localStorage 持久化工具 ==========
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data
  } catch {
    return null
  }
}

let saveTimer = null
function debouncedSave(sessions, activeId) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    // Map 不能直接 JSON.stringify,要转成数组
    const serialized = {
      sessions: Array.from(sessions.entries()),
      activeId,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    } catch (err) {
      console.warn('[持久化失败]', err)
    }
  }, 500)
}

// ========== Store 定义 ==========
export const useChatStore = defineStore('chat', () => {
  //  核心数据结构:Map<sessionId, Session>
  // Session = { id, title, messages: [...], createdAt }
  const sessions = reactive(new Map())
  const activeId = ref(null)
  const isGenerating = ref(false)

  // ========== 初始化:从 localStorage 恢复 ==========
  function hydrate() {
    const saved = loadFromStorage()
    if (saved && Array.isArray(saved.sessions)) {
      saved.sessions.forEach(([id, session]) => {
        sessions.set(id, session)
      })
      activeId.value = saved.activeId
    }
    // 如果没有任何会话,创建一个默认会话
    if (sessions.size === 0) {
      createSession()
    }
    // activeId 失效则兜底
    if (!activeId.value || !sessions.has(activeId.value)) {
      activeId.value = sessions.keys().next().value
    }
  }

  // ========== 计算属性 ==========
  /** 当前激活会话的消息列表 */
  const activeMessages = computed(() => {
    const s = sessions.get(activeId.value)
    return s ? s.messages : []
  })

  /** 所有会话,按创建时间倒序(最新的在上) */
  const sessionList = computed(() => {
    return Array.from(sessions.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    )
  })

  // ========== 会话增删改 ==========
  function createSession(title = '新的对话') {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const session = {
      id,
      title,
      messages: [
        {
          id: `m_${Date.now()}`,
          role: 'assistant',
          content: '你好,我是心灵树洞。这里很安全,你可以放心说出你的心事。\n\n想和我聊点什么呢?',
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
    }
    sessions.set(id, session)
    activeId.value = id
    persist()
    return id
  }

  function switchSession(id) {
    if (sessions.has(id)) {
      activeId.value = id
      persist()
    }
  }

  function deleteSession(id) {
    sessions.delete(id)
    // 如果删的是当前会话,切到第一个;如果没了,新建一个
    if (activeId.value === id) {
      const first = sessions.keys().next().value
      if (first) activeId.value = first
      else createSession()
    }
    persist()
  }

  function renameSession(id, title) {
    const s = sessions.get(id)
    if (s) {
      s.title = title
      persist()
    }
  }

  // ========== 消息操作 ==========
  function addMessage(message) {
    const s = sessions.get(activeId.value)
    if (!s) return
    s.messages.push({
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
      ...message,
    })
    // 如果是第一条用户消息,用它来当会话标题
    if (s.title === '新的对话' && message.role === 'user') {
      s.title = message.content.slice(0, 20)
    }
    persist()
  }

  /** 追加文本到最后一条 AI 消息(用于流式累积) */
  function appendToLastAIMessage(text) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0) return
    const last = s.messages[s.messages.length - 1]
    if (last.role === 'assistant') {
      last.content += text
    }
  }

  function persist() {
    debouncedSave(sessions, activeId.value)
  }

  return {
    // state
    sessions,
    activeId,
    isGenerating,
    // getters
    activeMessages,
    sessionList,
    // actions
    hydrate,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    addMessage,
    appendToLastAIMessage,
    persist,
  }
})

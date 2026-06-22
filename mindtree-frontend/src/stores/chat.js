import { defineStore } from 'pinia'
import { reactive, ref, computed } from 'vue'

const STORAGE_KEY = 'mindtree_sessions_v1'

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

export const useChatStore = defineStore('chat', () => {
  const sessions = reactive(new Map())
  const activeId = ref(null)
  const isGenerating = ref(false)

  function hydrate() {
    const saved = loadFromStorage()
    if (saved && Array.isArray(saved.sessions)) {
      saved.sessions.forEach(([id, session]) => {
        sessions.set(id, session)
      })
      activeId.value = saved.activeId
    }
    if (sessions.size === 0) {
      createSession()
    }
    if (!activeId.value || !sessions.has(activeId.value)) {
      activeId.value = sessions.keys().next().value
    }
  }

  const activeMessages = computed(() => {
    const s = sessions.get(activeId.value)
    return s ? s.messages : []
  })

  const sessionList = computed(() => {
    return Array.from(sessions.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    )
  })

  function createSession(title = '新会话') {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const session = {
      id,
      title,
      messages: [],
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

  function addMessage(message) {
    const s = sessions.get(activeId.value)
    if (!s) return
    s.messages.push({
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
      ...message,
    })
    if (s.title === '新会话' && message.role === 'user') {
      s.title = message.content.slice(0, 20)
    }
    persist()
  }

  function appendToLastAIMessage(text) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0) return
    const last = s.messages[s.messages.length - 1]
    if (last.role === 'assistant') {
      last.content += text
    }
  }

  function fillLastAIMessageIfEmpty(content) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0) return
    const last = s.messages[s.messages.length - 1]
    if (last.role === 'assistant' && !last.content.trim()) {
      last.content = content
    }
  }

  function setLastAIMessageSources(sources) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0) return
    const last = s.messages[s.messages.length - 1]
    if (last.role === 'assistant') {
      last.sources = Array.isArray(sources) ? sources : []
      persist()
    }
  }

  function persist() {
    debouncedSave(sessions, activeId.value)
  }

  return {
    sessions,
    activeId,
    isGenerating,
    activeMessages,
    sessionList,
    hydrate,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    addMessage,
    appendToLastAIMessage,
    fillLastAIMessageIfEmpty,
    setLastAIMessageSources,
    persist,
  }
})

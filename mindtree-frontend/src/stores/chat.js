import { defineStore } from 'pinia'
import { reactive, ref, computed } from 'vue'
import {
  clearKnowledgeDocuments,
  deleteKnowledgeDocument,
  fetchKnowledgeDocuments,
  uploadKnowledgeDocuments,
} from '@/api/chat'

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
  const documents = ref([])
  const retrievalMode = ref('keyword')
  const ragEnabled = ref(true)
  const knowledgeLoading = ref(false)
  const knowledgeNotice = ref('')
  const knowledgeError = ref('')

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
      messages: [
        {
          id: `m_${Date.now()}`,
          role: 'assistant',
          content: '你好，我是智语心聊 MindTree。你可以记录当前的想法、压力来源或需要梳理的问题。',
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

  function mergeToolIntoLastAIMessage(tool) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0) return
    const last = s.messages[s.messages.length - 1]
    if (last.role !== 'assistant') return
    if (!Array.isArray(last.tools)) last.tools = []
    const current = last.tools.find(item => item.id === tool.id)
    if (current) Object.assign(current, tool)
    else last.tools.push(tool)
  }

  function setLastAICitations(citations) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0) return
    const last = s.messages[s.messages.length - 1]
    if (last.role !== 'assistant') return
    last.citations = citations
  }

  function setLastAITools(tools) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0 || !tools?.length) return
    const last = s.messages[s.messages.length - 1]
    if (last.role !== 'assistant') return
    last.tools = tools
  }

  function fillLastAIMessageIfEmpty(content) {
    const s = sessions.get(activeId.value)
    if (!s || s.messages.length === 0) return
    const last = s.messages[s.messages.length - 1]
    if (last.role === 'assistant' && !last.content.trim()) {
      last.content = content
    }
  }

  function persist() {
    debouncedSave(sessions, activeId.value)
  }

  async function refreshKnowledge() {
    knowledgeLoading.value = true
    knowledgeError.value = ''
    try {
      const result = await fetchKnowledgeDocuments()
      documents.value = result.documents
      retrievalMode.value = result.retrievalMode
    } catch (err) {
      knowledgeError.value = err.message || '加载知识库失败'
    } finally {
      knowledgeLoading.value = false
    }
  }

  async function uploadKnowledge(files) {
    if (!files?.length) return
    knowledgeLoading.value = true
    knowledgeError.value = ''
    knowledgeNotice.value = ''
    try {
      const result = await uploadKnowledgeDocuments(files)
      documents.value = [...documents.value, ...result.documents]
      retrievalMode.value = result.retrievalMode
      knowledgeNotice.value = result.message || `已导入 ${result.documents.length} 份知识文件。`
    } catch (err) {
      knowledgeError.value = err.message || '上传知识库失败'
    } finally {
      knowledgeLoading.value = false
    }
  }

  async function removeKnowledgeDocument(id) {
    knowledgeLoading.value = true
    knowledgeError.value = ''
    knowledgeNotice.value = ''
    try {
      await deleteKnowledgeDocument(id)
      documents.value = documents.value.filter(item => item.id !== id)
      knowledgeNotice.value = '知识文件已移除。'
    } catch (err) {
      knowledgeError.value = err.message || '删除知识文件失败'
    } finally {
      knowledgeLoading.value = false
    }
  }

  async function clearKnowledge() {
    if (!documents.value.length) return
    knowledgeLoading.value = true
    knowledgeError.value = ''
    knowledgeNotice.value = ''
    try {
      await clearKnowledgeDocuments()
      documents.value = []
      knowledgeNotice.value = '知识库已清空。'
    } catch (err) {
      knowledgeError.value = err.message || '清空知识库失败'
    } finally {
      knowledgeLoading.value = false
    }
  }

  function toggleRag() {
    ragEnabled.value = !ragEnabled.value
  }

  return {
    sessions,
    activeId,
    isGenerating,
    activeMessages,
    clearKnowledge,
    documents,
    sessionList,
    knowledgeError,
    knowledgeLoading,
    knowledgeNotice,
    ragEnabled,
    refreshKnowledge,
    removeKnowledgeDocument,
    retrievalMode,
    hydrate,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    addMessage,
    appendToLastAIMessage,
    fillLastAIMessageIfEmpty,
    mergeToolIntoLastAIMessage,
    persist,
    setLastAICitations,
    setLastAITools,
    toggleRag,
    uploadKnowledge,
  }
})

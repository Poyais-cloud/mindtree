import { ref, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { streamChat } from '@/api/chat'
import { throttle } from '@/utils/throttle'

export function useChat() {
  const store = useChatStore()
  const error = ref(null)

  let controller = null

  async function sendMessage(userText) {
    if (!userText?.trim() || store.isGenerating) return

    error.value = null
    store.isGenerating = true

    store.addMessage({ role: 'user', content: userText.trim() })

    store.addMessage({ role: 'assistant', content: '' })

    const apiMessages = store.activeMessages
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.content }))

    controller = new AbortController()

    let buffer = ''
    const flushBuffer = throttle(() => {
      if (buffer) {
        store.appendToLastAIMessage(buffer)
        buffer = ''
      }
    }, 50)

    await streamChat({
      messages: apiMessages,
      ragEnabled: store.ragEnabled,
      signal: controller.signal,
      onChunk: (text) => {
        buffer += text
        flushBuffer()
      },
      onTool: (tool) => {
        store.mergeToolIntoLastAIMessage(tool)
        store.persist()
      },
      onCitations: (citations) => {
        store.setLastAICitations(citations)
        store.persist()
      },
      onDone: (payload = {}) => {
        if (buffer) {
          store.appendToLastAIMessage(buffer)
          buffer = ''
        }
        if (payload.citations?.length) store.setLastAICitations(payload.citations)
        if (payload.tools?.length) store.setLastAITools(payload.tools)
        store.fillLastAIMessageIfEmpty('这次没有收到有效回复。')
        store.isGenerating = false
        controller = null
        store.persist()
      },
      onError: (err) => {
        console.error('[对话出错]', err)
        error.value = err.message || '网络错误,请稍后重试'
        store.fillLastAIMessageIfEmpty(`抱歉，这次回复没有成功：${error.value}`)
        store.isGenerating = false
        controller = null
        store.persist()
      },
    })
  }

  function stopGenerating() {
    if (controller) {
      controller.abort()
      controller = null
    }
    store.fillLastAIMessageIfEmpty('已停止生成。')
    store.isGenerating = false
    store.persist()
  }

  onUnmounted(() => {
    stopGenerating()
  })

  return {
    error,
    sendMessage,
    stopGenerating,
  }
}

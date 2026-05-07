/**
 * useChat —— 对话业务逻辑的 composable
 */
import { ref, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { streamChat } from '@/api/chat'
import { throttle } from '@/utils/throttle'

export function useChat() {
  const store = useChatStore()
  const error = ref(null)

  /**
   * AbortController 实例,在 hook 作用域内持有
   * 每次新对话都要 new 一个新的(一个 controller 只能 abort 一次)
   */
  let controller = null

  /** 发送消息并接收流式回复 */
  async function sendMessage(userText) {
    if (!userText?.trim() || store.isGenerating) return

    error.value = null
    store.isGenerating = true

    // 1. push 用户消息
    store.addMessage({ role: 'user', content: userText.trim() })

    // 2. push 一条空的 AI 消息,后续 token 追加到它上面
    //    这样用户视觉上就是打字机效果
    store.addMessage({ role: 'assistant', content: '' })

    // 3. 构造发给后端的 messages(只要 role + content)
    const apiMessages = store.activeMessages
      .slice(0, -1) // 去掉刚加的空 AI 消息
      .map(m => ({ role: m.role, content: m.content }))

    // 4. 新建 AbortController
    controller = new AbortController()

    // 5. 节流 token 更新
    //    如果每个 token 都直接写 store,会触发大量 DOM diff,页面卡顿。
    //    用节流 50ms 批量 flush,人眼感知不到区别,但性能提升显著。
    let buffer = ''
    const flushBuffer = throttle(() => {
      if (buffer) {
        store.appendToLastAIMessage(buffer)
        buffer = ''
      }
    }, 50)

    await streamChat({
      messages: apiMessages,
      signal: controller.signal,
      onChunk: (text) => {
        buffer += text
        flushBuffer()
      },
      onDone: () => {
        // 最后一次确保 buffer 里的残留刷进去
        if (buffer) {
          store.appendToLastAIMessage(buffer)
          buffer = ''
        }
        store.isGenerating = false
        store.persist()
      },
      onError: (err) => {
        console.error('[对话出错]', err)
        error.value = err.message || '网络错误,请稍后重试'
        store.isGenerating = false
      },
    })
  }

  /** 中断当前生成 */
  function stopGenerating() {
    if (controller) {
      controller.abort()
      controller = null
    }
    store.isGenerating = false
  }

  /** 组件卸载时自动清理 —— 防止页面切走后后台请求还在跑 */
  onUnmounted(() => {
    stopGenerating()
  })

  return {
    error,
    sendMessage,
    stopGenerating,
  }
}

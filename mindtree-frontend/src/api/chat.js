/**
 * Chat API 模块
 *
 * 这个文件封装了所有与后端 /api/chat 的交互。
 *
 * 1. fetch + ReadableStream 手动解析 SSE
 * 2. AbortController 实现"停止生成"
 * 3. 节流批量更新(throttle)减少 DOM 刷新频率(放在 useChat 里用)
 * 4. TextDecoder 的 stream:true 防止中文乱码
 * 5. 错误分类处理(网络错/上游错/解析错)
 */

const API_BASE = import.meta.env.DEV ? '' : 'http://localhost:3000'

/**
 * 发起流式对话请求
 *
 * @param {Object} params
 * @param {Array} params.messages - OpenAI 格式的消息列表 [{role, content}]
 * @param {AbortSignal} params.signal - 用于中断请求
 * @param {Function} params.onChunk - 每收到一段新文本时的回调 (text: string) => void
 * @param {Function} params.onDone  - 流正常结束的回调
 * @param {Function} params.onError - 出错时的回调 (err: Error) => void
 */
export async function streamChat({ messages, signal, onChunk, onDone, onError }) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal, // ⭐ 关键:把 AbortController 的 signal 传给 fetch
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    // ⭐ 核心:拿到 ReadableStream 的 reader
    // response.body 本身就是一个 ReadableStream,fetch 原生支持流式
    const reader = response.body.getReader()

    // ⭐ TextDecoder 把二进制字节解码成字符串
    // 默认 UTF-8,中文一个字占 3 个字节
    const decoder = new TextDecoder()

    // ⭐ buffer:用来缓存跨 chunk 的不完整行
    // 因为 reader.read() 返回的一块数据,可能刚好切在 "data: xxx\n\n" 的中间
    // 比如上一块末尾是 "data: {\"content\":\"你", 下一块开头是 "好\"}\n\n"
    // 不缓存就会解析失败
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // stream:true 告诉 decoder 这不是最后一块
      // 如果一个中文字符被切到了两块之间,decoder 会缓存字节到下一次
      // 不加这个参数,中文会出现 \ufffd 乱码字符
      buffer += decoder.decode(value, { stream: true })

      // 按 \n\n 切分完整的 SSE 消息
      // (SSE 协议:每条消息以 \n\n 结束)
      const events = buffer.split('\n\n')

      // 最后一段可能是不完整的,留在 buffer 里等下一次
      buffer = events.pop() || ''

      for (const event of events) {
        // 每个事件可能包含多行,比如 "event: xxx\ndata: yyy"
        // 我们只关心 data: 开头的行
        const dataLines = event
          .split('\n')
          .filter(line => line.startsWith('data: '))

        for (const line of dataLines) {
          const payload = line.slice(6).trim()

          // 流结束标识(OpenAI 规范)
          if (payload === '[DONE]') {
            onDone?.()
            return
          }

          try {
            const json = JSON.parse(payload)

            // 上游返回了错误
            if (json.error) {
              throw new Error(json.error)
            }

            // 提取增量文本(OpenAI 格式)
            const delta = json.choices?.[0]?.delta?.content || ''
            if (delta) onChunk?.(delta)
          } catch (parseErr) {
            // 单条 JSON 解析失败不影响整体,只打日志
            console.warn('[SSE 解析失败]', payload, parseErr.message)
          }
        }
      }
    }

    onDone?.()
  } catch (err) {
    // AbortError 是用户主动停止,不算真错误,走特殊分支
    if (err.name === 'AbortError') {
      onDone?.()
      return
    }
    onError?.(err)
  }
}

/** 获取话题模板列表 */
export async function fetchTopics() {
  try {
    const res = await fetch(`${API_BASE}/api/topics`)
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

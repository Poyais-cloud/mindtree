const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function streamChat({ messages, signal, onChunk, onDone, onError }) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    })

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      const sseError = extractSSEError(bodyText)
      throw new Error(sseError || `HTTP ${response.status}`)
    }

    if (!response.body) {
      throw new Error('当前浏览器不支持流式响应')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        const dataLines = event
          .split('\n')
          .filter(line => line.startsWith('data: '))

        for (const line of dataLines) {
          const payload = line.slice(6).trim()

          if (payload === '[DONE]') {
            onDone?.()
            return
          }

          let json
          try {
            json = JSON.parse(payload)
          } catch (parseErr) {
            console.warn('[SSE 解析失败]', payload, parseErr.message)
            continue
          }

          if (json.error) throw new Error(json.error)

          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) onChunk?.(delta)
        }
      }
    }

    onDone?.()
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone?.()
      return
    }
    onError?.(err)
  }
}

function extractSSEError(text) {
  const line = text
    .split('\n')
    .find(item => item.startsWith('data: '))

  if (!line) return ''

  try {
    return JSON.parse(line.slice(6).trim()).error || ''
  } catch {
    return ''
  }
}

export async function fetchTopics() {
  try {
    const res = await fetch(`${API_BASE}/api/topics`)
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function streamChat({
  messages,
  ragEnabled = true,
  signal,
  onChunk,
  onTool,
  onCitations,
  onDone,
  onError,
}) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, ragEnabled }),
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
        const parsed = parseSSEEvent(event)
        if (!parsed) continue

        const { eventName, payload } = parsed

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

        if (eventName === 'token') {
          if (json.token) onChunk?.(json.token)
          continue
        }

        if (eventName === 'tool') {
          onTool?.(normalizeTool(json))
          continue
        }

        if (eventName === 'citations') {
          onCitations?.(json.citations || [])
          continue
        }

        if (eventName === 'error') {
          throw new Error(formatStreamError(json))
        }

        if (eventName === 'done') {
          onDone?.({
            citations: json.citations || [],
            tools: Array.isArray(json.tools) ? json.tools.map(normalizeTool) : [],
          })
          return
        }

        if (json.error) throw new Error(json.error)

        const delta = json.choices?.[0]?.delta?.content || ''
        if (delta) onChunk?.(delta)
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

function parseSSEEvent(event) {
  const lines = event
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (!lines.length) return null

  const eventName = lines
    .find(line => line.startsWith('event:'))
    ?.slice(6)
    .trim() || 'message'

  const data = lines
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .join('\n')

  if (!data) return null
  return { eventName, payload: data }
}

function normalizeTool(tool = {}) {
  return {
    id: tool.id || `tool_${Date.now()}`,
    name: tool.name || 'unknown_tool',
    args: tool.args || {},
    status: tool.status || 'running',
    result: typeof tool.result === 'string'
      ? tool.result
      : tool.result
        ? JSON.stringify(tool.result, null, 2)
        : '',
  }
}

function formatStreamError(payload = {}) {
  const message = payload.message || payload.error || '请求失败'
  return payload.details ? `${message}\n${payload.details}` : message
}

function extractSSEError(text) {
  const line = text
    .split('\n')
    .find(item => item.startsWith('data:'))

  if (!line) return ''

  try {
    const payload = JSON.parse(line.slice(5).trim())
    return formatStreamError(payload)
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

function formatApiError(payload, fallback) {
  const message = payload?.error || payload?.message || fallback
  return payload?.details ? `${message}\n${payload.details}` : message
}

export async function fetchKnowledgeDocuments() {
  const res = await fetch(`${API_BASE}/api/knowledge`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, '加载知识库失败'))
  return {
    documents: data.documents || [],
    retrievalMode: data.retrievalMode || 'keyword',
  }
}

export async function uploadKnowledgeDocuments(files) {
  const formData = new FormData()
  Array.from(files).forEach(file => formData.append('files', file))

  const res = await fetch(`${API_BASE}/api/knowledge/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, '上传知识库失败'))
  return {
    documents: data.documents || [],
    retrievalMode: data.retrievalMode || 'keyword',
    message: data.message || '',
  }
}

export async function deleteKnowledgeDocument(id) {
  const res = await fetch(`${API_BASE}/api/knowledge/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(formatApiError(data, '删除知识文件失败'))
  }
}

export async function clearKnowledgeDocuments() {
  const res = await fetch(`${API_BASE}/api/knowledge`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(formatApiError(data, '清空知识库失败'))
  }
}

import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const config = {
  apiKey: process.env.XUNFEI_API_KEY,
  baseUrl: (process.env.XUNFEI_BASE_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2').replace(/\/$/, ''),
  chatPath: process.env.XUNFEI_CHAT_PATH || '/chat/completions',
  model: process.env.MODEL || 'xop3qwen1b7',
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES) || 1024 * 1024,
  maxKnowledgeFileBytes: Number(process.env.MAX_KNOWLEDGE_FILE_BYTES) || 2 * 1024 * 1024,
}

const PSYCHOLOGY_SYSTEM_PROMPT = `你是"智语心聊",英文名 MindTree,一个情绪支持对话助手。
你遵循以下原则与用户对话：

1. 【倾听优先】你不是问题的解决者，而是情绪的陪伴者。用户的感受永远比道理重要。
2. 【不做诊断】你永远不说"你有抑郁症/焦虑症"等诊断性判断。你不是医生。
3. 【保持温度】回应要柔软、不评判。多用"我听到了"、"这一定很不容易"之类的共情语言。
4. 【引导表达】在合适的时候引导用户多说一些,比如"可以多说说这件事吗"。
5. 【危机干预】如果用户表达出自伤、自杀或严重危机的信号,温柔地提醒专业求助渠道。
6. 【语言风格】自然、口语化、有温度,避免说教。回应一般在 80-200 字之间,不要太长。
7. 【边界】如果用户问的不是情感类问题,温柔地引导回对话的初衷。
8. 【引用资料】如果本轮提供了知识库资料,只能把它当作参考背景,不要把资料包装成诊断结论。
9. 【格式规范】当用户需要结构化建议时,可以直接使用 Markdown,不要把完整回复包在代码块里。

请始终以"智语心聊 MindTree"的身份回应,第一人称用"我"。`

const CRISIS_RESPONSE_PROMPT = `重要安全提醒：用户刚才的表达中可能出现自伤、自杀或严重危机信号。
你的回复必须优先处理安全：
1. 先温柔确认对方此刻的安全状态。
2. 明确建议用户立刻联系身边可信的人,不要独自承受。
3. 如果存在即时危险,建议马上拨打当地紧急电话或心理危机热线。
4. 不要给出任何自伤方法、危险步骤或细节。
5. 语气要短、稳、具体,不要说教。`

const CRISIS_PATTERNS = [
  /自杀|轻生|结束生命|不想活|活不下去|想死|去死|跳楼|割腕/,
  /吞药|服药自杀|上吊|煤气自杀|伤害自己|自残/,
  /撑不下去|没有意义|没人需要我|消失算了|好绝望|彻底崩溃/,
]

const TOPIC_PROMPTS = {
  daily: '记录一下今天的状态,包括让你感到轻松或消耗的事情。',
  stress: '描述最近主要的压力来源,以及它对你生活的影响。',
  relationship: '说说最近让你困扰的人际关系或沟通场景。',
  anxiety: '写下让你焦虑的事情,以及你最担心的结果。',
  sleep: '记录最近的睡眠情况,以及睡前反复想到的内容。',
}

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxKnowledgeFileBytes },
})

app.use(cors({ origin: config.corsOrigin === '*' ? '*' : config.corsOrigin }))
app.use(express.json({ limit: config.maxBodyBytes }))

function createAppError(code, message, details = '', status = 500) {
  const error = new Error(message)
  error.code = code
  error.details = details
  error.status = status
  return error
}

function getErrorPayload(error, fallbackMessage) {
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || fallbackMessage,
      details: error.details || '',
      status: error.status || 500,
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: fallbackMessage,
    details: '',
    status: 500,
  }
}

function hasCrisisSignal(messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  if (!lastUserMessage) return false
  return CRISIS_PATTERNS.some((pattern) => pattern.test(lastUserMessage.content))
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '消息列表不能为空'
  }

  if (messages.length > 50) {
    return '消息数量过多,请开启新对话后重试'
  }

  const validRoles = new Set(['user', 'assistant'])
  for (const message of messages) {
    if (!message || !validRoles.has(message.role)) {
      return '消息角色不合法'
    }
    if (typeof message.content !== 'string' || !message.content.trim()) {
      return '消息内容不能为空'
    }
    if (message.content.length > 8000) {
      return '单条消息过长,请缩短后重试'
    }
  }

  return null
}

function normalizeStructuredContent(result) {
  if (result && typeof result === 'object' && result.structuredContent) {
    return result.structuredContent
  }
  if (result && typeof result === 'object' && 'toolResult' in result) {
    return result.toolResult
  }
  return {}
}

function contentToText(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.content)) {
    return ''
  }

  return result.content
    .filter((item) => item && typeof item === 'object' && item.type === 'text')
    .map((item) => item.text || '')
    .join('\n')
    .trim()
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function modelFetch(body) {
  if (!config.apiKey) {
    throw createAppError('MISSING_API_KEY', '服务器未配置 API Key', '请检查后端 `.env` 中的 `XUNFEI_API_KEY`。', 500)
  }

  let response
  try {
    response = await fetch(`${config.baseUrl}${config.chatPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        Accept: '*/*',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw createAppError(
      'NETWORK_UNREACHABLE',
      '无法连接到模型服务',
      '当前运行环境访问讯飞 MaaS 失败。请检查网络、代理、VPN 或防火墙设置。',
      502
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 401) {
      throw createAppError('INVALID_API_KEY', 'API Key 无效或已过期', text || '请检查 `XUNFEI_API_KEY` 是否正确。', 401)
    }
    if (response.status === 429) {
      throw createAppError('RATE_LIMITED', '模型请求过于频繁', text || '请稍后重试，或检查账户配额是否充足。', 429)
    }
    throw createAppError('MODEL_HTTP_ERROR', `模型请求失败（${response.status}）`, text || '上游模型服务返回异常响应。', 502)
  }

  return response
}

let mcpSessionPromise = null
let mcpSessionAlive = false

function resetMcpSession() {
  mcpSessionAlive = false
  mcpSessionPromise = null
}

async function createMcpSession() {
  if (mcpSessionPromise && mcpSessionAlive) {
    return mcpSessionPromise
  }

  if (mcpSessionPromise) {
    const old = mcpSessionPromise
    mcpSessionPromise = null
    old.then((s) => s.close()).catch(() => {})
  }

  mcpSessionPromise = (async () => {
    const client = new McpClient({
      name: 'mindtree-agent-orchestrator',
      version: '1.1.0',
    })

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve(__dirname, './mcp-server.js')],
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
      stderr: 'pipe',
    })

    if (transport.stderr) {
      transport.stderr.on('data', (chunk) => {
        const message = chunk.toString().trim()
        if (message) {
          console.error(`[mindtree-mcp] ${message}`)
        }
      })
    }

    await client.connect(transport)
    mcpSessionAlive = true
    console.log('[MCP] 会话已建立')

    return {
      client,
      transport,
      async close() {
        mcpSessionAlive = false
        mcpSessionPromise = null
        await client.close().catch(() => {})
        await transport.close().catch(() => {})
      },
    }
  })().catch((error) => {
    mcpSessionAlive = false
    mcpSessionPromise = null
    console.error('[MCP] 会话建立失败:', error.message)
    throw error
  })

  return mcpSessionPromise
}

async function runToolAndEmit(res, session, name, args) {
  const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  sendSse(res, 'tool', {
    id,
    name,
    args,
    status: 'running',
  })

  const result = await session.client.callTool({ name, arguments: args })
  const structured = normalizeStructuredContent(result)
  const resultText = contentToText(result) || JSON.stringify(structured, null, 2)
  const isError = !!(result && typeof result === 'object' && result.isError)
  const invocation = {
    id,
    name,
    args,
    status: isError ? 'error' : 'success',
    result: resultText,
  }

  sendSse(res, 'tool', {
    ...invocation,
    result: structured || resultText,
  })

  return {
    invocation,
    structured,
    resultText,
    isError,
    citations: Array.isArray(structured?.citations) ? structured.citations : [],
  }
}

function shouldUseTimeTool(text) {
  return /现在几点|几点了|当前时间|今天几号|今天日期|今天是|日期|时间/.test(text)
}

function formatCitationContext(citations) {
  if (!citations.length) return ''

  const lines = citations.slice(0, 6).map((citation, index) => {
    const snippet = String(citation.snippet || '').replace(/\s+/g, ' ').slice(0, 500)
    return `${index + 1}. ${citation.title || '未命名资料'}：${snippet}`
  })

  return [
    '【知识库资料】',
    '以下内容来自用户上传的知识库。它们只能作为理解用户语境的参考；如果资料不足,请明确说明无法从资料中确认。',
    ...lines,
  ].join('\n')
}

function buildInjectedMessages(incomingMessages, agentContext) {
  const filtered = incomingMessages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-18)

  const systemMessages = [{ role: 'system', content: PSYCHOLOGY_SYSTEM_PROMPT }]

  if (hasCrisisSignal(filtered)) {
    systemMessages.push({ role: 'system', content: CRISIS_RESPONSE_PROMPT })
  }

  const citationContext = formatCitationContext(agentContext.citations)
  if (citationContext) {
    systemMessages.push({ role: 'system', content: citationContext })
  }

  if (agentContext.timeContext) {
    systemMessages.push({ role: 'system', content: `【工具结果】${agentContext.timeContext}` })
  }

  return [...systemMessages, ...filtered]
}

async function buildAgentContext(res, incomingMessages, ragEnabled) {
  const session = await createMcpSession()
  const lastUserMessage = [...incomingMessages].reverse().find((message) => message.role === 'user')
  const lastUserText = lastUserMessage?.content?.trim() || ''
  const context = {
    citations: [],
    tools: [],
    timeContext: '',
  }

  if (ragEnabled && lastUserText) {
    const retrieved = await runToolAndEmit(res, session, 'retrieve_knowledge', {
      query: lastUserText,
      topK: 4,
    })
    context.tools.push(retrieved.invocation)
    context.citations.push(...retrieved.citations)
    if (retrieved.citations.length) {
      sendSse(res, 'citations', { citations: retrieved.citations })
    }
  }

  if (lastUserText && shouldUseTimeTool(lastUserText)) {
    const timeResult = await runToolAndEmit(res, session, 'get_current_time', {})
    context.tools.push(timeResult.invocation)
    if (!timeResult.isError && timeResult.structured?.locale) {
      context.timeContext = `当前系统时间：${timeResult.structured.locale}`
    }
  }

  return context
}

async function relayModelStream(response, res, donePayload) {
  if (!response.body) {
    throw createAppError('STREAM_UNSUPPORTED', '模型服务没有返回流式响应', '', 502)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let closed = false

  res.on('close', () => {
    closed = true
    reader.cancel().catch(() => {})
  })

  while (!closed) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const lines = event.split('\n').map((line) => line.trim()).filter(Boolean)
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (raw === '[DONE]') {
          sendSse(res, 'done', donePayload)
          res.end()
          return
        }

        try {
          const json = JSON.parse(raw)
          const token = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || ''
          if (token) {
            sendSse(res, 'token', { token })
          }
        } catch {
        }
      }
    }
  }

  if (!closed) {
    sendSse(res, 'done', donePayload)
    res.end()
  }
}

app.get(['/health', '/api/health'], async (_, res) => {
  try {
    const session = await createMcpSession()
    const result = await session.client.callTool({
      name: 'list_knowledge_documents',
      arguments: {},
    })
    const structured = normalizeStructuredContent(result)
    res.json({
      status: 'ok',
      model: config.model,
      agent: true,
      documents: Array.isArray(structured.documents) ? structured.documents.length : 0,
      retrievalMode: structured.retrievalMode || 'keyword',
    })
  } catch (error) {
    const payload = getErrorPayload(error, 'MCP 健康检查失败')
    res.status(payload.status).json({
      status: 'error',
      code: payload.code,
      error: payload.message,
      details: payload.details,
    })
  }
})

app.get('/api/topics', (_, res) => {
  res.json(TOPIC_PROMPTS)
})

app.get('/api/knowledge', async (_, res) => {
  try {
    const session = await createMcpSession()
    const result = await session.client.callTool({
      name: 'list_knowledge_documents',
      arguments: {},
    })
    const structured = normalizeStructuredContent(result)
    res.json({
      documents: structured.documents || [],
      retrievalMode: structured.retrievalMode || 'keyword',
    })
  } catch (error) {
    const payload = getErrorPayload(error, '加载知识库失败')
    res.status(payload.status).json({
      error: payload.message,
      code: payload.code,
      details: payload.details,
    })
  }
})

app.post('/api/knowledge/upload', upload.array('files'), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : []
    const session = await createMcpSession()
    const result = await session.client.callTool({
      name: 'ingest_knowledge_documents',
      arguments: {
        documents: files.map((file) => ({
          name: file.originalname,
          content: file.buffer.toString('utf-8'),
        })),
      },
    })

    const structured = normalizeStructuredContent(result)
    if (result.isError) {
      throw createAppError(structured.code || 'MCP_TOOL_ERROR', structured.message || '知识库导入失败', structured.details || '', 400)
    }

    res.json({
      documents: structured.documents || [],
      message: structured.message || '上传成功',
      retrievalMode: structured.retrievalMode || 'keyword',
    })
  } catch (error) {
    const payload = getErrorPayload(error, '知识库导入失败')
    res.status(payload.status).json({
      error: payload.message,
      code: payload.code,
      details: payload.details,
    })
  }
})

app.delete('/api/knowledge/:id', async (req, res) => {
  try {
    const session = await createMcpSession()
    const result = await session.client.callTool({
      name: 'delete_knowledge_document',
      arguments: { id: req.params.id },
    })

    const structured = normalizeStructuredContent(result)
    if (result.isError) {
      throw createAppError(structured.code || 'MCP_TOOL_ERROR', structured.message || '删除失败', structured.details || '', 400)
    }

    res.json({ ok: true })
  } catch (error) {
    const payload = getErrorPayload(error, '删除失败')
    res.status(payload.status).json({
      error: payload.message,
      code: payload.code,
      details: payload.details,
    })
  }
})

app.delete('/api/knowledge', async (_, res) => {
  try {
    const session = await createMcpSession()
    const result = await session.client.callTool({
      name: 'clear_knowledge_documents',
      arguments: {},
    })

    const structured = normalizeStructuredContent(result)
    if (result.isError) {
      throw createAppError(structured.code || 'MCP_TOOL_ERROR', structured.message || '清空失败', structured.details || '', 400)
    }

    res.json({ ok: true })
  } catch (error) {
    const payload = getErrorPayload(error, '清空失败')
    res.status(payload.status).json({
      error: payload.message,
      code: payload.code,
      details: payload.details,
    })
  }
})

app.post(['/api/chat/stream', '/api/chat'], async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  try {
    const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const validationError = validateMessages(incomingMessages)
    if (validationError) {
      throw createAppError('INVALID_MESSAGES', validationError, '', 400)
    }

    const ragEnabled = req.body?.ragEnabled !== false
    const agentContext = await buildAgentContext(res, incomingMessages, ragEnabled)
    const messages = buildInjectedMessages(incomingMessages, agentContext)

    const streamResponse = await modelFetch({
      model: config.model,
      messages,
      max_tokens: 2000,
      temperature: 0.8,
      stream: true,
    })

    await relayModelStream(streamResponse, res, {
      citations: agentContext.citations,
      tools: agentContext.tools,
    })
  } catch (error) {
    const payload = getErrorPayload(error, '服务异常')
    sendSse(res, 'error', {
      code: payload.code,
      message: payload.message,
      details: payload.details,
    })
    sendSse(res, 'done', { citations: [], tools: [] })
    res.end()
  }
})

app.use((_, res) => {
  res.status(404).json({ error: 'Not Found' })
})

const server = app.listen(config.port, () => {
  console.log(`[智语心聊 MindTree 后端] http://localhost:${config.port}`)
  console.log(`[模型] ${config.model}`)
  console.log(`[Agent] MCP/RAG 已启用`)
  console.log(`[API Key] ${config.apiKey ? '已配置' : '未配置,请检查 .env'}`)
})

async function shutdown(signal) {
  console.log(`[${signal}] 正在关闭...`)
  if (mcpSessionPromise) {
    try {
      const session = await mcpSessionPromise
      await session.close()
    } catch {}
  }
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

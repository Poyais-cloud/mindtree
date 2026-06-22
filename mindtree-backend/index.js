const http = require('http')
const https = require('https')
const dotenv = require('dotenv')
const {
  clampTopK,
  clearVaultConfig,
  getStatus,
  indexVault,
  saveVaultConfig,
  searchMoodLogs,
  writeReview,
} = require('./knowledge')

dotenv.config()

const PORT = process.env.PORT || 3000
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 1024 * 1024

const PROVIDERS = {
  xunfei: {
    label: '讯飞千问',
    key: process.env.XUNFEI_API_KEY,
    model: process.env.XUNFEI_MODEL || process.env.MODEL || 'xop3qwen1b7',
    baseUrl: process.env.XUNFEI_BASE_URL || 'https://maas-api.cn-huabei-1.xf-yun.com',
    path: process.env.XUNFEI_API_PATH || '/v2/chat/completions',
  },
  deepseek: {
    label: 'DeepSeek',
    key: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || process.env.MODEL || 'deepseek-v4-flash',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    path: process.env.DEEPSEEK_API_PATH || '/chat/completions',
  },
}

function getProvider() {
  const name = String(process.env.AI_PROVIDER || 'xunfei').toLowerCase()
  const preset = PROVIDERS[name]
  if (preset) return { name, ...preset }

  return {
    name: 'custom',
    label: 'OpenAI-compatible',
    key: process.env.OPENAI_COMPATIBLE_API_KEY,
    model: process.env.OPENAI_COMPATIBLE_MODEL || process.env.MODEL || 'deepseek-v4-flash',
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.deepseek.com',
    path: process.env.OPENAI_COMPATIBLE_API_PATH || '/chat/completions',
  }
}

const provider = getProvider()
const API_KEY = provider.key
const MODEL = provider.model

const PSYCHOLOGY_SYSTEM_PROMPT = `你是"智语心聊",英文名 MindTree,一个情绪支持对话助手。
你遵循以下原则与用户对话：

1. 【倾听优先】你不是问题的解决者，而是情绪的陪伴者。用户的感受永远比道理重要。
2. 【不做诊断】你永远不说"你有抑郁症/焦虑症"等诊断性判断。你不是医生。
3. 【保持温度】回应要柔软、不评判。多用"我听到了"、"这一定很不容易"之类的共情语言。
4. 【引导表达】在合适的时候引导用户多说一些,比如"可以多说说这件事吗"。
5. 【危机干预】如果用户表达出自伤、自杀或严重危机的信号,温柔地提醒专业求助渠道
6. 【语言风格】自然、口语化、有温度,避免说教。回应通常写成 220-380 字左右,尽量不要过短。优先分成 2-3 个自然段：先接住情绪,再结合对方的处境做更具体的理解,最后给出 1-2 个温和的追问、安抚或可执行的小建议。除非用户明确要求极简回复,否则不要只写一两句。
7. 【边界】如果用户问的不是情感类问题(比如让你写代码、做作业),温柔地引导回对话的初衷。
8. 【格式规范】当用户需要结构化建议时,可以直接使用 Markdown,不要把完整回复包在代码块里。代码块只用于真正展示代码片段。

请始终以"智语心聊 MindTree"的身份回应,第一人称用"我"。`

const MOOD_LOG_CONTEXT_PROMPT = `你会收到从用户 Obsidian 心情日记库中检索到的相关日志片段。
使用方式：
1. 这些日志是用户过去的真实记录,只能作为理解情绪模式、重复压力源和支持性追问的线索。
2. 不要把日志当作诊断依据,不要下医学判断。
3. 回答时可以自然提到"你之前的记录里也出现过类似感受",但不要逐字暴露大段隐私内容。
4. 如果日志线索不足或和当前问题关系弱,要直接说明并主要回应用户此刻的表达。
5. 优先做陪伴、澄清、复盘和下一步小行动建议。`

const REVIEW_SYSTEM_PROMPT = `你是"智语心聊 MindTree"的心理日志复盘助手。
请基于用户本轮对话和可用的相关心情日志,生成一篇适合写入 Obsidian 的心理日志复盘。

要求：
1. 不做医学诊断,不使用"抑郁症/焦虑症"等诊断性判断。
2. 结构清晰、温和、具体,避免说教。
3. 帮用户看见近期反复出现的情绪、触发场景、身体反应、需求和可尝试的小行动。
4. 可以引用"相关旧日志线索",但只做概括,不要暴露过长原文。
5. 如果出现自伤、自杀或严重危机内容,复盘必须把安全支持和求助资源放在靠前位置。
6. 使用 Markdown 输出。`

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

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function writeJsonError(res, statusCode, errorMsg) {
  sendJson(res, statusCode, { error: errorMsg })
}

function readJsonBody(req, res, callback) {
  let body = ''
  let receivedBytes = 0
  let bodyTooLarge = false

  req.on('data', chunk => {
    receivedBytes += chunk.length
    if (receivedBytes > MAX_BODY_BYTES) {
      bodyTooLarge = true
      writeJsonError(res, 413, '请求内容过大')
      req.destroy()
      return
    }
    body += chunk
  })

  req.on('end', () => {
    if (bodyTooLarge) return
    try {
      callback(body ? JSON.parse(body) : {})
    } catch {
      writeJsonError(res, 400, '请求格式错误')
    }
  })
}

function formatMoodLogContext(sources) {
  if (!sources.length) return ''

  return [
    '以下是从用户 Obsidian 心情日记库中检索到的相关片段,请只作为心理支持对话的背景线索：',
    ...sources.map((source, index) => {
      return [
        `${index + 1}. 《${source.title || source.sourceName}》`,
        `路径: ${source.sourceRelPath || source.sourceName}`,
        `片段: ${source.snippet}`,
      ].join('\n')
    }),
  ].join('\n\n')
}

function injectSystemPrompt(messages, context = '') {
  const filtered = messages.filter(m => m.role !== 'system')
  const injected = [{ role: 'system', content: PSYCHOLOGY_SYSTEM_PROMPT }, ...filtered]

  if (hasCrisisSignal(filtered)) injected.splice(1, 0, { role: 'system', content: CRISIS_RESPONSE_PROMPT })
  if (context) {
    injected.splice(1, 0, { role: 'system', content: MOOD_LOG_CONTEXT_PROMPT })
    injected.splice(2, 0, { role: 'system', content: context })
  }
  return injected
}

function hasCrisisSignal(messages) {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) return false
  return CRISIS_PATTERNS.some(pattern => pattern.test(lastUserMessage.content))
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '消息列表不能为空'
  if (messages.length > 50) return '消息数量过多,请开启新对话后重试'

  const validRoles = new Set(['user', 'assistant'])
  for (const message of messages) {
    if (!message || !validRoles.has(message.role)) return '消息角色不合法'
    if (typeof message.content !== 'string' || !message.content.trim()) return '消息内容不能为空'
    if (message.content.length > 8000) return '单条消息过长,请缩短后重试'
  }
  return null
}

function writeSSEError(res, errorMsg) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

function writeSSEData(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function providerOptions(timeout = 45000) {
  const url = new URL(provider.path, provider.baseUrl)
  return {
    hostname: url.hostname,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    method: 'POST',
    timeout,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json, text/event-stream, */*',
    },
  }
}

function createRequestBody(messages, settings = {}) {
  return {
    model: MODEL,
    messages,
    max_tokens: settings.maxTokens || 2000,
    temperature: settings.temperature ?? 0.8,
    stream: Boolean(settings.stream),
  }
}

function handleStreamRequest(messages, streamOptions, res) {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  const useKnowledge = Boolean(streamOptions?.useKnowledge)
  const topK = clampTopK(streamOptions?.topK, 5)
  let sources = []

  if (useKnowledge && lastUserMessage?.content) {
    try {
      sources = searchMoodLogs(lastUserMessage.content, topK)
    } catch (err) {
      console.error('[心情库检索失败]', err.message)
    }
  }

  const context = formatMoodLogContext(sources)
  const injectedMessages = injectSystemPrompt(messages, context)
  const requestBody = createRequestBody(injectedMessages, { maxTokens: 2600, temperature: 0.8, stream: true })

  const upstreamReq = https.request(providerOptions(60000), (upstreamRes) => {
    console.log(`[上游响应 ${provider.label}]`, upstreamRes.statusCode)

    if (upstreamRes.statusCode !== 200) {
      let errData = ''
      upstreamRes.on('data', chunk => { errData += chunk })
      upstreamRes.on('end', () => {
        console.error('[上游错误]', errData)
        writeSSEError(res, `AI 服务返回 ${upstreamRes.statusCode}`)
      })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    writeSSEData(res, { type: 'sources', sources })
    upstreamRes.pipe(res)

    res.on('close', () => {
      if (!upstreamRes.complete) upstreamReq.destroy()
    })
  })

  upstreamReq.on('error', (err) => {
    console.error('[上游请求错误]', err.message)
    if (!res.headersSent) writeSSEError(res, `网络错误: ${err.message}`)
  })

  upstreamReq.on('timeout', () => {
    console.error('[上游请求超时]')
    upstreamReq.destroy()
    if (!res.headersSent) writeSSEError(res, '请求超时,请稍后重试')
  })

  upstreamReq.write(JSON.stringify(requestBody))
  upstreamReq.end()
}

function callChatCompletion(messages, settings = {}) {
  return new Promise((resolve, reject) => {
    const requestBody = createRequestBody(messages, {
      maxTokens: settings.maxTokens || 2600,
      temperature: settings.temperature ?? 0.65,
      stream: false,
    })

    const upstreamReq = https.request(providerOptions(60000), (upstreamRes) => {
      let data = ''
      upstreamRes.on('data', chunk => { data += chunk })
      upstreamRes.on('end', () => {
        if (upstreamRes.statusCode !== 200) {
          reject(new Error(`AI 服务返回 ${upstreamRes.statusCode}: ${data.slice(0, 300)}`))
          return
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.message?.content
          if (!content) {
            reject(new Error('AI 服务没有返回有效内容'))
            return
          }
          resolve(content)
        } catch {
          reject(new Error('AI 服务响应解析失败'))
        }
      })
    })

    upstreamReq.on('error', err => reject(err))
    upstreamReq.on('timeout', () => {
      upstreamReq.destroy()
      reject(new Error('请求超时,请稍后重试'))
    })

    upstreamReq.write(JSON.stringify(requestBody))
    upstreamReq.end()
  })
}

function buildReviewUserContent(messages, sources) {
  const conversation = messages
    .slice(-16)
    .map(message => `${message.role === 'user' ? '用户' : 'MindTree'}：${message.content}`)
    .join('\n\n')

  const context = formatMoodLogContext(sources)

  return [
    '请为下面这段心理支持对话生成一篇 Obsidian 心理日志复盘。',
    '',
    '## 本轮对话',
    conversation,
    ...(context ? ['', '## 相关旧日志', context] : []),
  ].join('\n')
}

const server = http.createServer((req, res) => {
  setCors(res)
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, {
      status: 'ok',
      provider: provider.name,
      providerLabel: provider.label,
      model: MODEL,
      hasApiKey: Boolean(API_KEY),
    })
  }

  if (req.method === 'GET' && pathname === '/api/topics') return sendJson(res, 200, TOPIC_PROMPTS)

  if (req.method === 'GET' && pathname === '/api/knowledge/status') {
    try { return sendJson(res, 200, getStatus()) }
    catch (err) { return writeJsonError(res, 500, err.message || '读取心情库状态失败') }
  }

  if (req.method === 'POST' && pathname === '/api/knowledge/vault') {
    readJsonBody(req, res, (body) => {
      try {
        const vault = saveVaultConfig(body)
        sendJson(res, 200, { ok: true, vault })
      } catch (err) {
        writeJsonError(res, 400, err.message || '保存心情库配置失败')
      }
    })
    return
  }

  if (req.method === 'DELETE' && pathname === '/api/knowledge/vault') {
    try {
      clearVaultConfig()
      return sendJson(res, 200, { ok: true })
    } catch (err) {
      return writeJsonError(res, 500, err.message || '清空心情库配置失败')
    }
  }

  if (req.method === 'POST' && pathname === '/api/knowledge/index') {
    readJsonBody(req, res, async () => {
      try {
        const result = await indexVault()
        sendJson(res, 200, { ok: true, ...result })
      } catch (err) {
        writeJsonError(res, 400, err.message || '导入心情库失败')
      }
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/knowledge/search') {
    readJsonBody(req, res, (body) => {
      try {
        const query = typeof body.query === 'string' ? body.query : ''
        const sources = searchMoodLogs(query, clampTopK(body.topK, 5))
        sendJson(res, 200, { sources })
      } catch (err) {
        writeJsonError(res, 400, err.message || '检索心情库失败')
      }
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/review') {
    if (!API_KEY) return writeJsonError(res, 401, `服务器未配置 ${provider.label} API Key`)

    readJsonBody(req, res, async (body) => {
      try {
        const messages = Array.isArray(body.messages)
          ? body.messages.filter(message => message?.role && message?.content?.trim())
          : []
        const validationError = validateMessages(messages)
        if (validationError) return writeJsonError(res, 400, validationError)

        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
        const useKnowledge = body.useKnowledge !== false
        const sources = useKnowledge && lastUserMessage?.content
          ? searchMoodLogs(lastUserMessage.content, clampTopK(body.topK, 5))
          : []

        const content = await callChatCompletion([
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          ...(hasCrisisSignal(messages) ? [{ role: 'system', content: CRISIS_RESPONSE_PROMPT }] : []),
          { role: 'user', content: buildReviewUserContent(messages, sources) },
        ], { temperature: 0.55, maxTokens: 3000 })

        sendJson(res, 200, {
          content,
          sources,
          title: `MindTree 心理复盘 ${new Date().toLocaleDateString('zh-CN')}`,
        })
      } catch (err) {
        writeJsonError(res, 500, err.message || '生成心理复盘失败')
      }
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/review/write') {
    readJsonBody(req, res, (body) => {
      try {
        if (typeof body.content !== 'string' || !body.content.trim()) return writeJsonError(res, 400, '复盘内容不能为空')
        const result = writeReview({ title: body.title, content: body.content, sources: body.sources })
        sendJson(res, 200, { ok: true, ...result })
      } catch (err) {
        writeJsonError(res, 400, err.message || '写回 Obsidian 失败')
      }
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    if (!API_KEY) return writeSSEError(res, `服务器未配置 ${provider.label} API Key`)

    let body = ''
    let receivedBytes = 0
    let bodyTooLarge = false

    req.on('data', chunk => {
      receivedBytes += chunk.length
      if (receivedBytes > MAX_BODY_BYTES) {
        bodyTooLarge = true
        res.statusCode = 413
        writeSSEError(res, '请求内容过大')
        req.destroy()
        return
      }
      body += chunk
    })

    req.on('end', () => {
      if (bodyTooLarge) return
      try {
        const { messages, useKnowledge, topK } = JSON.parse(body)
        const validationError = validateMessages(messages)
        if (validationError) return writeSSEError(res, validationError)
        handleStreamRequest(messages, { useKnowledge, topK }, res)
      } catch {
        writeSSEError(res, '请求格式错误')
      }
    })
    return
  }

  res.statusCode = 404
  res.end('Not Found')
})

server.listen(PORT, () => {
  console.log(`[智语心聊 MindTree 后端] http://localhost:${PORT}`)
  console.log(`[AI Provider] ${provider.label} (${provider.name})`)
  console.log(`[模型] ${MODEL}`)
  console.log(`[API Key] ${API_KEY ? '已配置' : '未配置,请检查 .env'}`)
})

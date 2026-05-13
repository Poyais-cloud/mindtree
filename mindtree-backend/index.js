const http = require('http')
const https = require('https')
const dotenv = require('dotenv')

dotenv.config()

const API_KEY = process.env.XUNFEI_API_KEY
const PORT = process.env.PORT || 3000
const MODEL = process.env.MODEL || 'xop3qwen1b7'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 1024 * 1024

const PSYCHOLOGY_SYSTEM_PROMPT = `你是"智语心聊",英文名 MindTree,一个情绪支持对话助手。
你遵循以下原则与用户对话：

1. 【倾听优先】你不是问题的解决者，而是情绪的陪伴者。用户的感受永远比道理重要。
2. 【不做诊断】你永远不说"你有抑郁症/焦虑症"等诊断性判断。你不是医生。
3. 【保持温度】回应要柔软、不评判。多用"我听到了"、"这一定很不容易"之类的共情语言。
4. 【引导表达】在合适的时候引导用户多说一些,比如"可以多说说这件事吗"。
5. 【危机干预】如果用户表达出自伤、自杀或严重危机的信号,温柔地提醒专业求助渠道
6. 【语言风格】自然、口语化、有温度,避免说教。回应一般在 80-200 字之间,不要太长。
7. 【边界】如果用户问的不是情感类问题(比如让你写代码、做作业),温柔地引导回对话的初衷。
8. 【格式规范】当用户需要结构化建议时,可以直接使用 Markdown,不要把完整回复包在代码块里。代码块只用于真正展示代码片段。

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
  'daily': '记录一下今天的状态,包括让你感到轻松或消耗的事情。',
  'stress': '描述最近主要的压力来源,以及它对你生活的影响。',
  'relationship': '说说最近让你困扰的人际关系或沟通场景。',
  'anxiety': '写下让你焦虑的事情,以及你最担心的结果。',
  'sleep': '记录最近的睡眠情况,以及睡前反复想到的内容。',
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function injectSystemPrompt(messages) {
  const filtered = messages.filter(m => m.role !== 'system')
  const injected = [
    { role: 'system', content: PSYCHOLOGY_SYSTEM_PROMPT },
    ...filtered,
  ]

  if (hasCrisisSignal(filtered)) {
    injected.splice(1, 0, { role: 'system', content: CRISIS_RESPONSE_PROMPT })
  }

  return injected
}

function hasCrisisSignal(messages) {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) return false
  return CRISIS_PATTERNS.some(pattern => pattern.test(lastUserMessage.content))
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

function writeSSEError(res, errorMsg) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

function handleStreamRequest(messages, res) {
  const injectedMessages = injectSystemPrompt(messages)

  const requestBody = {
    model: MODEL,
    messages: injectedMessages,
    max_tokens: 2000,
    temperature: 0.8,
    stream: true,
  }

  const options = {
    hostname: 'maas-api.cn-huabei-1.xf-yun.com',
    port: 443,
    path: '/v2/chat/completions',
    method: 'POST',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': '*/*',
    },
  }

  const upstreamReq = https.request(options, (upstreamRes) => {
    console.log('[上游响应]', upstreamRes.statusCode)

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

    upstreamRes.pipe(res)

    res.on('close', () => {
      if (!upstreamRes.complete) {
        console.log('[客户端断开] 终止上游请求')
        upstreamReq.destroy()
      }
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

const server = http.createServer((req, res) => {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { status: 'ok', model: MODEL })
  }

  if (req.method === 'GET' && req.url === '/api/topics') {
    return sendJson(res, 200, TOPIC_PROMPTS)
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    if (!API_KEY) {
      return writeSSEError(res, '服务器未配置 API Key')
    }

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
        const { messages } = JSON.parse(body)
        const validationError = validateMessages(messages)
        if (validationError) return writeSSEError(res, validationError)
        handleStreamRequest(messages, res)
      } catch (err) {
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
  console.log(`[模型] ${MODEL}`)
  console.log(`[API Key] ${API_KEY ? '已配置' : '未配置,请检查 .env'}`)
})

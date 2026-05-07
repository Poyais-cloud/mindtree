const http = require('http')
const https = require('https')
const dotenv = require('dotenv')

dotenv.config()

const API_KEY = process.env.XUNFEI_API_KEY
const PORT = process.env.PORT || 3000
const MODEL = process.env.MODEL || 'xop3qwen1b7'

// ========== 心理对话的灵魂：System Prompt ==========
// 这段是让"套壳"变成"心理对话应用"的关键
const PSYCHOLOGY_SYSTEM_PROMPT = `你是"心灵树洞"，一位专业、温柔、富有共情力的心理陪伴助手。
你遵循以下原则与用户对话：

1. 【倾听优先】你不是问题的解决者，而是情绪的陪伴者。用户的感受永远比道理重要。
2. 【不做诊断】你永远不说"你有抑郁症/焦虑症"等诊断性判断。你不是医生。
3. 【保持温度】回应要柔软、不评判。多用"我听到了"、"这一定很不容易"之类的共情语言。
4. 【引导表达】在合适的时候引导用户多说一些,比如"可以多说说这件事吗"。
5. 【危机干预】如果用户表达出自伤、自杀或严重危机的信号,温柔地提醒专业求助渠道
6. 【语言风格】自然、口语化、有温度,避免说教。回应一般在 80-200 字之间,不要太长。
7. 【边界】如果用户问的不是情感类问题(比如让你写代码、做作业),温柔地引导回对话的初衷。
8. 【格式规范】当用户需要结构化建议时,可以直接用 Markdown 语法(# 标题、**加粗**、- 列表 等),但【绝对不要】把整个回复包在 \`\`\`markdown ... \`\`\` 代码块里 —— 用户的前端会直接把 Markdown 渲染成富文本,包代码块反而会让格式失效。代码块只用于真正展示代码片段。

请始终以"心灵树洞"的身份回应,第一人称用"我"。`

// ========== 话题模板:让用户有引导地开始对话 ==========
const TOPIC_PROMPTS = {
  'daily': '今天过得怎么样?有什么想和我分享的吗?',
  'stress': '最近是不是压力有点大?可以和我说说是什么让你这样感觉的。',
  'relationship': '人际关系上有什么让你困扰的吗?我在这里听。',
  'anxiety': '有什么事情让你焦虑不安吗?慢慢说,我们一起理一理。',
  'sleep': '睡眠最近怎么样?有什么在心里放不下吗?',
}

// ========== CORS 通用处理 ==========
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ========== 把 System Prompt 注入到消息序列最前面 ==========
// 关键点:前端不需要知道这个 Prompt 的存在,后端统一注入
function injectSystemPrompt(messages) {
  // 如果第一条已经是 system 消息,就替换掉(防止前端乱传)
  const filtered = messages.filter(m => m.role !== 'system')
  return [
    { role: 'system', content: PSYCHOLOGY_SYSTEM_PROMPT },
    ...filtered,
  ]
}

// ========== 工具:往 SSE 流里写一条错误消息 ==========
function writeSSEError(res, errorMsg) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

// ========== 核心:调用讯飞 LLM 并把流转发给前端 ==========
function handleStreamRequest(messages, res) {
  const injectedMessages = injectSystemPrompt(messages)

  const requestBody = {
    model: MODEL,
    messages: injectedMessages,
    max_tokens: 2000,
    temperature: 0.8, // 心理对话要有点温度,不能太死板
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

    // 设置 SSE 响应头 —— 这是让前端能流式接收的关键
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // 关闭 Nginx 缓冲,防止 Nginx 攒批发送

    // 核心一行:把上游流直接 pipe 给客户端
    // 这样讯飞每吐一个 token,前端就能立刻收到,零延迟
    upstreamRes.pipe(res)

    // 客户端主动断开时(比如点了"停止生成"),我们也要终止上游请求
    // 这一步能避免"用户已走,后端还在烧钱调 LLM"
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

// ========== HTTP 路由 ==========
const server = http.createServer((req, res) => {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  // 健康检查
  if (req.method === 'GET' && req.url === '/health') {
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ status: 'ok', model: MODEL }))
  }

  // 获取话题模板列表
  if (req.method === 'GET' && req.url === '/api/topics') {
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify(TOPIC_PROMPTS))
  }

  // 核心对话接口
  if (req.method === 'POST' && req.url === '/api/chat') {
    if (!API_KEY) {
      return writeSSEError(res, '服务器未配置 API Key')
    }

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const { messages } = JSON.parse(body)
        if (!Array.isArray(messages) || messages.length === 0) {
          return writeSSEError(res, '消息列表不能为空')
        }
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
  console.log(`[心灵树洞后端] http://localhost:${PORT}`)
  console.log(`[模型] ${MODEL}`)
  console.log(`[API Key] ${API_KEY ? '已配置' : '⚠️  未配置,请检查 .env'}`)
})

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config()

const state = {
  documents: [],
  chunks: [],
  avgChunkLen: 0,
}

const config = {
  apiKey: process.env.QWEN_API_KEY,
  baseUrl: (process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, ''),
  embeddingModel: process.env.QWEN_EMBEDDING_MODEL || 'text-embedding-v3',
  chunkSize: 800,
  chunkOverlap: 150,
  bm25K1: 1.5,
  bm25B: 0.75,
  hybridWeight: 0.7,
}

const DATA_DIR = path.resolve(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'knowledge.json')

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

function createAppError(code, message, details = '', status = 500) {
  const error = new Error(message)
  error.code = code
  error.details = details
  error.status = status
  return error
}

function tokenize(text) {
  const freq = new Map()
  const add = (token) => {
    if (token.length < 2) return
    freq.set(token, (freq.get(token) || 0) + 1)
  }

  const normalized = text.toLowerCase()

  const cjk = normalized.match(/[一-鿿]+/g) || []
  for (const segment of cjk) {
    for (let i = 0; i < segment.length; i++) {
      add(segment[i])
    }
    for (let i = 0; i < segment.length - 1; i++) {
      add(segment.slice(i, i + 2))
    }
  }

  const words = normalized.match(/[a-z0-9]{2,}/g) || []
  for (const w of words) {
    add(w)
  }

  return freq
}

function tokenSet(freqMap) {
  return new Set(freqMap.keys())
}

function chunkText(text, maxSize, overlap) {
  const chunks = []

  const paragraphs = text.split(/\n\s*\n/)

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    if (trimmed.length <= maxSize) {
      chunks.push(trimmed)
      continue
    }

    const sentences = trimmed.split(/(?<=[。！？!?；;])\s*/)
    let current = ''
    for (const sent of sentences) {
      if (!sent.trim()) continue
      if (current.length + sent.length <= maxSize) {
        current += (current ? '' : '') + sent
      } else {
        if (current.trim()) {
          chunks.push(current.trim())
          current = current.slice(-overlap) + sent
        } else {
          current = sent
        }
      }
    }
    if (current.trim()) {
      chunks.push(current.trim())
    }
  }

  const result = []
  for (const chunk of chunks) {
    if (chunk.length <= maxSize) {
      result.push(chunk)
      continue
    }
    let start = 0
    while (start < chunk.length) {
      const end = Math.min(chunk.length, start + maxSize)
      result.push(chunk.slice(start, end).trim())
      start += maxSize - overlap
    }
  }

  return result.filter(c => c.length > 0)
}

function bm25Score(queryTokens, chunk, chunks, avgLen) {
  const docLen = chunk.text.length
  const N = chunks.length
  let score = 0

  for (const [term, qtf] of queryTokens) {
    let df = 0
    for (const c of chunks) {
      if (c.tokens.has(term)) df++
    }
    if (df === 0) continue

    const tf = chunk.tokens.get(term) || 0
    if (tf === 0) continue

    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1)

    const k1 = config.bm25K1
    const b = config.bm25B
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / (avgLen || 1)))

    score += idf * tfNorm * qtf
  }

  const firstQuarter = chunk.text.slice(0, Math.floor(chunk.text.length * 0.25)).toLowerCase()
  for (const term of queryTokens.keys()) {
    if (term.length >= 3 && firstQuarter.includes(term)) {
      score += 0.5
    }
  }

  return score
}

function cosineSimilarity(a, b) {
  const len = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function createEmbedding(text) {
  if (!config.apiKey) return null

  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: text.slice(0, 6000),
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw createAppError('EMBEDDING_HTTP_ERROR', `Embedding 请求失败（${response.status}）`, errText || '上游 embedding 服务返回异常响应。', 502)
  }

  const result = await response.json()
  const vector = result?.data?.[0]?.embedding
  if (!vector) {
    throw createAppError('EMBEDDING_EMPTY', 'Embedding 生成失败', '模型返回为空，已无法建立向量索引。', 502)
  }

  return vector
}

function currentRetrievalMode() {
  return config.apiKey ? 'embedding' : 'keyword'
}

function hasEmbeddings() {
  return state.chunks.some((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)
}

async function searchKnowledge(query, topK = 4) {
  if (!state.chunks.length) return []

  const queryTokens = tokenize(query)
  if (queryTokens.size === 0) return []

  const avgLen = state.avgChunkLen || state.chunks.reduce((s, c) => s + c.text.length, 0) / Math.max(state.chunks.length, 1)

  const keywordScores = state.chunks.map((chunk) => ({
    chunk,
    keywordScore: bm25Score(queryTokens, chunk, state.chunks, avgLen),
  }))

  let queryEmbedding = null
  if (config.apiKey && hasEmbeddings()) {
    queryEmbedding = await createEmbedding(query).catch(() => null)
  }

  const useHybrid = queryEmbedding && hasEmbeddings()

  const scored = keywordScores.map(({ chunk, keywordScore }) => {
    let score
    if (useHybrid && Array.isArray(chunk.embedding)) {
      const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding)
      score = config.hybridWeight * vectorScore + (1 - config.hybridWeight) * keywordScore
    } else {
      score = keywordScore
    }

    return { chunk, score }
  })

  const minScore = useHybrid ? 0.1 : 0.01

  return scored
    .filter((item) => item.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      id: chunk.id,
      title: chunk.documentName,
      snippet: chunk.text,
      source: `${useHybrid ? '向量+关键词混合检索' : '本地关键词检索'} / ${chunk.documentName}`,
      score: Number(score.toFixed(4)),
    }))
}

async function ingestDocuments(documents) {
  const supported = documents.filter((doc) => /\.(txt|md|markdown|json)$/i.test(doc.name))

  if (!supported.length) {
    throw createAppError('UNSUPPORTED_FILES', '没有可导入的知识文件', '仅支持 .md、.markdown、.txt、.json 文件。', 400)
  }

  const inserted = []

  for (const source of supported) {
    const content = source.content.trim()
    if (!content) continue

    const document = {
      id: uid('doc'),
      name: source.name,
      content,
      createdAt: Date.now(),
    }

    state.documents.push(document)
    inserted.push({
      id: document.id,
      name: document.name,
      createdAt: document.createdAt,
    })

    const parts = chunkText(content, config.chunkSize, config.chunkOverlap)

    const embeddings = []
    if (config.apiKey) {
      for (let i = 0; i < parts.length; i += 3) {
        const batch = parts.slice(i, i + 3)
        const results = await Promise.allSettled(batch.map((p) => createEmbedding(p)))
        embeddings.push(...results.map((r) => (r.status === 'fulfilled' ? r.value : null)))
      }
    }

    for (let i = 0; i < parts.length; i++) {
      state.chunks.push({
        id: uid('chunk'),
        documentId: document.id,
        documentName: document.name,
        text: parts[i],
        tokens: tokenize(parts[i]),
        embedding: embeddings[i] || null,
      })
    }
  }

  if (!inserted.length) {
    throw createAppError('EMPTY_FILES', '上传的文件内容为空', '请确认文件不是空文件，且编码为 UTF-8。', 400)
  }

  if (state.chunks.length > 0) {
    state.avgChunkLen = state.chunks.reduce((s, c) => s + c.text.length, 0) / state.chunks.length
  }

  persist()
  return inserted
}

function listDocuments() {
  return state.documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt,
  }))
}

function deleteDocument(id) {
  const before = state.documents.length
  state.documents = state.documents.filter((doc) => doc.id !== id)
  state.chunks = state.chunks.filter((chunk) => chunk.documentId !== id)

  if (before === state.documents.length) {
    throw createAppError('DOCUMENT_NOT_FOUND', '知识文件不存在', '请确认传入的文档 ID 是否正确。', 404)
  }

  if (state.chunks.length > 0) {
    state.avgChunkLen = state.chunks.reduce((s, c) => s + c.text.length, 0) / state.chunks.length
  } else {
    state.avgChunkLen = 0
  }

  persist()
  return { ok: true, id }
}

function clearDocuments() {
  state.documents = []
  state.chunks = []
  state.avgChunkLen = 0
  persist()
  return { ok: true }
}

function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }

    const serialized = {
      documents: state.documents,
      chunks: state.chunks.map((chunk) => ({
        ...chunk,
        tokens: Array.from(chunk.tokens.entries()),
      })),
      avgChunkLen: state.avgChunkLen,
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(serialized, null, 2), 'utf-8')
  } catch (err) {
    console.error('[知识库持久化失败]', err.message)
  }
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) return

    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    const data = JSON.parse(raw)

    state.documents = data.documents || []
    state.chunks = (data.chunks || []).map((chunk) => ({
      ...chunk,
      tokens: new Map(chunk.tokens || []),
    }))
    state.avgChunkLen = data.avgChunkLen || 0

    console.error(`[知识库] 已从磁盘加载 ${state.documents.length} 份文档、${state.chunks.length} 个片段`)
  } catch (err) {
    console.error('[知识库加载失败]', err.message)
  }
}

function toTextContent(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  }
}

function toErrorContent(error) {
  return {
    content: [{ type: 'text', text: error.details ? `${error.message}\n${error.details}` : error.message }],
    structuredContent: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details || '',
    },
    isError: true,
  }
}

loadFromDisk()

const server = new McpServer({
  name: 'mindtree-agent-mcp-server',
  version: '1.1.0',
})

server.registerTool(
  'retrieve_knowledge',
  {
    description: '从 MindTree 知识库检索与用户问题最相关的资料片段。有 embedding 时融合向量和 BM25 分数，没有时退化为纯 BM25 关键词检索。',
    inputSchema: z.object({
      query: z.string().min(1, 'query 不能为空'),
      topK: z.number().int().min(1).max(10).optional(),
    }),
  },
  async ({ query, topK = 4 }) => {
    try {
      const citations = await searchKnowledge(query, topK)
      return toTextContent({
        citations,
        count: citations.length,
        retrievalMode: config.apiKey && hasEmbeddings() ? 'hybrid' : currentRetrievalMode(),
      })
    } catch (error) {
      return toErrorContent(error)
    }
  },
)

server.registerTool(
  'list_knowledge_documents',
  {
    description: '列出当前 MindTree 知识库中的全部文档',
    inputSchema: z.object({}),
  },
  async () =>
    toTextContent({
      documents: listDocuments(),
      retrievalMode: currentRetrievalMode(),
    }),
)

server.registerTool(
  'ingest_knowledge_documents',
  {
    description: '导入知识文档到 MindTree 知识库并建立检索索引。支持 .md / .txt / .json 文件。',
    inputSchema: z.object({
      documents: z.array(
        z.object({
          name: z.string().min(1, 'name 不能为空'),
          content: z.string().min(1, 'content 不能为空'),
        }),
      ).min(1, '至少导入一份文档'),
    }),
  },
  async ({ documents }) => {
    try {
      const inserted = await ingestDocuments(documents)
      return toTextContent({
        documents: inserted,
        message: `已导入 ${inserted.length} 份知识文件。`,
        retrievalMode: currentRetrievalMode(),
      })
    } catch (error) {
      return toErrorContent(error)
    }
  },
)

server.registerTool(
  'delete_knowledge_document',
  {
    description: '删除指定的知识文档及其全部索引片段',
    inputSchema: z.object({
      id: z.string().min(1, 'id 不能为空'),
    }),
  },
  async ({ id }) => {
    try {
      return toTextContent(deleteDocument(id))
    } catch (error) {
      return toErrorContent(error)
    }
  },
)

server.registerTool(
  'clear_knowledge_documents',
  {
    description: '清空知识库中的所有文档与索引',
    inputSchema: z.object({}),
  },
  async () => toTextContent(clearDocuments()),
)

server.registerTool(
  'get_current_time',
  {
    description: '获取当前系统时间',
    inputSchema: z.object({}),
  },
  async () =>
    toTextContent({
      iso: new Date().toISOString(),
      locale: new Date().toLocaleString('zh-CN', { hour12: false }),
    }),
)

const transport = new StdioServerTransport()
await server.connect(transport)

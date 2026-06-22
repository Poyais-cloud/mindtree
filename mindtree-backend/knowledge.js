const fs = require('fs')
const path = require('path')
const MiniSearch = require('minisearch')

const DATA_DIR = path.join(process.cwd(), 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'mood-vault.json')
const INDEX_PATH = path.join(DATA_DIR, 'mood-knowledge.json')
const REVIEW_FOLDER = process.env.OBSIDIAN_REVIEW_DIR || 'MindTree Reviews'
const MAX_MD_FILE_BYTES = Number(process.env.OBSIDIAN_MAX_FILE_BYTES) || 2 * 1024 * 1024

let searchIndex = null
let meta = null
let indexInfo = null
let loadAttempted = false

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
  : null

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function isCjk(token) {
  return /[\u3400-\u9fff]/.test(token)
}

function tokenize(input) {
  const text = String(input || '').toLowerCase()
  if (!text.trim()) return []

  if (segmenter) {
    return [...segmenter.segment(text)]
      .filter(part => part.isWordLike)
      .map(part => part.segment.trim())
      .filter(token => token && (isCjk(token) || token.length >= 2))
  }

  return text
    .split(/[^\p{L}\p{N}_]+/u)
    .map(token => token.trim())
    .filter(token => token && (isCjk(token) || token.length >= 2))
}

function createSearchIndex() {
  return new MiniSearch({
    fields: ['title', 'text'],
    storeFields: [
      'title',
      'sourceName',
      'sourcePath',
      'sourceRelPath',
      'snippet',
      'updatedAt',
    ],
    tokenize,
    searchOptions: {
      boost: { title: 4, text: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
}

function loadVaultConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
      return {
        name: typeof data.name === 'string' ? data.name : '',
        path: typeof data.path === 'string' ? data.path : '',
      }
    }
  } catch {}
  return { name: '', path: '' }
}

function resetIndexMemory() {
  searchIndex = null
  meta = null
  indexInfo = null
  loadAttempted = false
}

function removeIndexFile() {
  try {
    if (fs.existsSync(INDEX_PATH)) fs.unlinkSync(INDEX_PATH)
  } catch {}
  resetIndexMemory()
}

function saveVaultConfig(input) {
  const vaultPath = path.resolve(String(input.path || '').trim())
  if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
    throw new Error('Obsidian 库路径不存在或不是文件夹')
  }

  const previous = loadVaultConfig()
  const config = {
    name: String(input.name || path.basename(vaultPath)).trim() || path.basename(vaultPath),
    path: vaultPath,
  }

  ensureDataDir()
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')

  // 更换路径后清掉旧索引，避免界面误以为还在使用上一套库
  if (!previous.path || path.resolve(previous.path) !== vaultPath) {
    removeIndexFile()
  }

  return config
}

function clearVaultConfig() {
  ensureDataDir()
  try {
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH)
  } catch {}
  removeIndexFile()
  return { name: '', path: '' }
}

function isPathInside(baseDir, filePath) {
  const base = path.resolve(baseDir)
  const target = path.resolve(filePath)
  return target === base || target.startsWith(`${base}${path.sep}`)
}

function getConfiguredVault() {
  const config = loadVaultConfig()
  if (!config.path) throw new Error('尚未配置 Obsidian 心情库路径')
  if (!fs.existsSync(config.path) || !fs.statSync(config.path).isDirectory()) {
    throw new Error('已配置的 Obsidian 心情库路径不可用')
  }
  return config
}

function stripFrontMatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function extractFrontMatterTitle(text) {
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!block) return ''
  const title = block[1].match(/^title:\s*(.+)$/m)
  if (!title) return ''
  return title[1].trim().replace(/^["']|["']$/g, '')
}

function normalizeMarkdown(text) {
  return stripFrontMatter(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)]]/g, '$1 $2')
    .replace(/\[\[([^\]]+)]]/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractTitle(rawText, filename) {
  const frontMatterTitle = extractFrontMatterTitle(rawText)
  if (frontMatterTitle) return frontMatterTitle

  const h1 = stripFrontMatter(rawText).match(/^#\s+(.+)$/m)
  if (h1) return h1[1].trim()

  return filename.replace(/\.md$/i, '')
}

function chunkText(text, maxSize = 900, overlap = 160) {
  const chunks = []
  const paragraphs = text.split(/\n\s*\n/)

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue

    if (trimmed.length <= maxSize) {
      chunks.push(trimmed)
      continue
    }

    const sentences = trimmed.split(/(?<=[。！？!?；;])\s*/)
    let current = ''
    for (const sentence of sentences) {
      const part = sentence.trim()
      if (!part) continue

      if (current.length + part.length <= maxSize) {
        current += part
      } else {
        if (current.trim()) chunks.push(current.trim())
        current = `${current.slice(-overlap)}${part}`
      }
    }

    if (current.trim()) chunks.push(current.trim())
  }

  return chunks
}

function walkMarkdownFiles(vaultPath) {
  const files = []

  function walk(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'node_modules') continue
      if (entry.isDirectory() && entry.name === REVIEW_FOLDER) continue

      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue

      const stat = fs.statSync(fullPath)
      if (stat.size > MAX_MD_FILE_BYTES) continue
      files.push({
        name: entry.name,
        path: fullPath,
        relPath: path.relative(vaultPath, fullPath),
        size: stat.size,
        updatedAt: Math.round(stat.mtimeMs),
      })
    }
  }

  walk(vaultPath)
  return files.sort((a, b) => b.updatedAt - a.updatedAt)
}

function readMarkdownFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function makeId(filePath, index) {
  return `${filePath}#${index}`
}

function loadIndex() {
  if (searchIndex || loadAttempted) return
  loadAttempted = true

  try {
    if (!fs.existsSync(INDEX_PATH)) return
    const raw = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))

    searchIndex = MiniSearch.loadJSON(JSON.stringify(raw.searchIndex), {
      fields: ['title', 'text'],
      storeFields: [
        'title',
        'sourceName',
        'sourcePath',
        'sourceRelPath',
        'snippet',
        'updatedAt',
      ],
      tokenize,
      searchOptions: {
        boost: { title: 4, text: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    })
    meta = new Map(raw.meta || [])
    indexInfo = raw.info || null
  } catch (err) {
    console.error('[心情库] 索引加载失败:', err.message)
    searchIndex = null
    meta = null
    indexInfo = null
  }
}

function saveIndex() {
  ensureDataDir()
  fs.writeFileSync(
    INDEX_PATH,
    JSON.stringify({
      searchIndex: JSON.parse(JSON.stringify(searchIndex)),
      meta: [...meta.entries()],
      info: indexInfo,
    }),
    'utf-8'
  )
}

async function indexVault() {
  const vault = getConfiguredVault()
  const files = walkMarkdownFiles(vault.path)
  const docs = []
  const nextMeta = new Map()

  for (const file of files) {
    const raw = readMarkdownFile(file.path)
    if (!raw.trim()) continue

    const title = extractTitle(raw, file.name)
    const normalized = normalizeMarkdown(raw)
    const chunks = chunkText(normalized)

    chunks.forEach((chunk, index) => {
      const id = makeId(file.path, index)
      const doc = {
        id,
        title,
        text: chunk,
        sourceName: file.name,
        sourcePath: file.path,
        sourceRelPath: file.relPath,
        snippet: chunk.slice(0, 700),
        updatedAt: file.updatedAt,
      }
      docs.push(doc)
      nextMeta.set(id, {
        title,
        sourceName: file.name,
        sourcePath: file.path,
        sourceRelPath: file.relPath,
        updatedAt: file.updatedAt,
      })
    })
  }

  searchIndex = createSearchIndex()
  meta = nextMeta
  loadAttempted = true

  if (docs.length) searchIndex.addAll(docs)

  indexInfo = {
    vaultName: vault.name,
    vaultPath: vault.path,
    fileCount: files.length,
    chunkCount: docs.length,
    indexedAt: Date.now(),
  }
  saveIndex()

  return {
    vault: vault.name,
    fileCount: files.length,
    fragments: docs.length,
    indexedAt: indexInfo.indexedAt,
  }
}

function getStatus() {
  const vault = loadVaultConfig()
  loadIndex()

  const indexed = Boolean(
    searchIndex &&
    indexInfo &&
    vault.path &&
    path.resolve(indexInfo.vaultPath) === path.resolve(vault.path)
  )

  let sizeBytes = 0
  try {
    if (fs.existsSync(INDEX_PATH)) sizeBytes = fs.statSync(INDEX_PATH).size
  } catch {}

  return {
    vault,
    index: {
      indexed,
      stale: Boolean(indexInfo && vault.path && path.resolve(indexInfo.vaultPath) !== path.resolve(vault.path)),
      fileCount: indexed ? indexInfo.fileCount : 0,
      docCount: indexed ? searchIndex.documentCount : 0,
      sizeBytes,
      indexedAt: indexed ? indexInfo.indexedAt : null,
    },
  }
}

function clampTopK(value, fallback = 5) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(12, Math.round(parsed)))
}

function searchMoodLogs(query, topK = 5) {
  const vault = getConfiguredVault()
  loadIndex()

  if (!searchIndex || !searchIndex.documentCount || !query || !query.trim()) return []
  if (!indexInfo || path.resolve(indexInfo.vaultPath) !== path.resolve(vault.path)) return []

  const results = searchIndex.search(query, {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 4, text: 1 },
  })

  const grouped = new Map()
  for (const result of results) {
    const sourcePath = result.sourcePath || meta?.get(result.id)?.sourcePath
    if (!sourcePath || !isPathInside(vault.path, sourcePath)) continue

    const current = grouped.get(sourcePath) || {
      score: Number(result.score || 0),
      title: result.title || meta?.get(result.id)?.title || path.basename(sourcePath, '.md'),
      sourceName: result.sourceName || meta?.get(result.id)?.sourceName || path.basename(sourcePath),
      sourcePath,
      sourceRelPath: result.sourceRelPath || meta?.get(result.id)?.sourceRelPath || path.relative(vault.path, sourcePath),
      updatedAt: result.updatedAt || meta?.get(result.id)?.updatedAt || 0,
      snippets: [],
    }

    current.score = Math.max(current.score, Number(result.score || 0))
    if (current.snippets.length < 2 && result.snippet) {
      current.snippets.push(String(result.snippet).slice(0, 700))
    }
    grouped.set(sourcePath, current)
  }

  return [...grouped.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, clampTopK(topK))
    .map(item => ({
      score: Number(item.score.toFixed(2)),
      title: item.title,
      sourceName: item.sourceName,
      sourcePath: item.sourcePath,
      sourceRelPath: item.sourceRelPath,
      snippet: item.snippets.join('\n...\n'),
      updatedAt: item.updatedAt,
    }))
}

function safeFilename(input) {
  return String(input || '')
    .trim()
    .replace(/[\\/:*?"<>|#]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'MindTree-review'
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function localTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('')
}

function fileTimestamp(date = new Date()) {
  return localTimestamp(date).replace(/[-:]/g, '').replace(' ', '-')
}

function sourceLinks(sources) {
  const unique = new Map()
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source || !source.sourceName) continue
    unique.set(source.sourcePath || source.sourceName, source)
  }

  return [...unique.values()]
    .slice(0, 12)
    .map(source => `- [[${String(source.sourceName).replace(/\.md$/i, '')}]]`)
}

function buildReviewMarkdown({ title, content, sources }) {
  const created = localTimestamp()
  const sourceSection = sourceLinks(sources)
  const body = String(content || '').trim()
  const withHeading = body.startsWith('#') ? body : `# ${title}\n\n${body}`

  return [
    '---',
    `title: ${title}`,
    `created: ${created}`,
    'tags:',
    '  - MindTree',
    '  - 心理复盘',
    'type: 心理日志复盘',
    '---',
    '',
    withHeading,
    ...(sourceSection.length ? ['', '## 关联心情日志', '', ...sourceSection] : []),
    '',
  ].join('\n')
}

function writeReview({ title, content, sources }) {
  const vault = getConfiguredVault()
  const reviewTitle = String(title || `MindTree 心理复盘 ${localTimestamp()}`).trim()
  const targetDir = path.resolve(vault.path, REVIEW_FOLDER)

  if (!isPathInside(vault.path, targetDir)) {
    throw new Error('复盘写回目录必须位于 Obsidian 库内部')
  }

  fs.mkdirSync(targetDir, { recursive: true })

  const baseName = `${fileTimestamp()}-${safeFilename(reviewTitle)}.md`
  let filePath = path.join(targetDir, baseName)
  let suffix = 2
  while (fs.existsSync(filePath)) {
    filePath = path.join(targetDir, `${baseName.replace(/\.md$/i, '')}-${suffix}.md`)
    suffix += 1
  }

  fs.writeFileSync(filePath, buildReviewMarkdown({ title: reviewTitle, content, sources }), 'utf-8')

  return {
    title: reviewTitle,
    filePath,
    relativePath: path.relative(vault.path, filePath),
  }
}

module.exports = {
  clampTopK,
  getStatus,
  indexVault,
  loadVaultConfig,
  saveVaultConfig,
  searchMoodLogs,
  writeReview,
  clearVaultConfig,
}

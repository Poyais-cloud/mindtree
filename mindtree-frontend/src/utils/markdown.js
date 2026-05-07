/**
 * Markdown 渲染 + XSS 防护 + 代码高亮
 */
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
// 按需注册语言，避免 bundle 过大（全量 hljs 大约 500KB）
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml' // HTML 用 xml
import markdownLang from 'highlight.js/lib/languages/markdown'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('markdown', markdownLang)
hljs.registerLanguage('md', markdownLang)

// ========== marked 配置 ==========
// 自定义渲染器：代码块接入 highlight.js
const renderer = new marked.Renderer()
renderer.code = function (code, lang) {
  // marked v12 兼容：code 参数可能是 string 或 { text, lang, escaped } 对象
  let text = code
  let language = lang
  if (typeof code === 'object' && code !== null) {
    text = code.text
    language = code.lang || language
  }

  const validLang = language && hljs.getLanguage(language) ? language : null
  let highlighted
  try {
    highlighted = validLang
      ? hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value
      : hljs.highlightAuto(text).value
  } catch {
    highlighted = escapeHtml(text)
  }

  const langLabel = validLang || 'plain'
  return `<pre class="code-block"><div class="code-head"><span class="code-lang">${langLabel}</span></div><code class="hljs language-${langLabel}">${highlighted}</code></pre>`
}

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
})

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ========== 流式 Markdown 预处理 ==========
/**
 * 针对流式场景修正内容，让 marked 在任一时刻都能渲染合理的中间态。
 *
 * 1) 如果整个回答被 ```markdown ... ``` 包着（LLM 常见坏习惯），剥掉外层。
 * 2) 如果代码块 fence 数量为奇数（流式过程中开了没关），虚拟补一个闭合。
 */
function preprocessStreamingMarkdown(raw) {
  if (!raw) return ''

  let text = raw

  // --- 修复 1: 剥离外层 ```markdown ... ``` 包裹 ---
  const wholeFenceMatch = text.match(
    /^\s*```(?:markdown|md|text|plain)?\s*\n([\s\S]*?)\n```\s*$/i
  )
  if (wholeFenceMatch) {
    text = wholeFenceMatch[1]
  }

  // --- 修复 2: 流式过程中未闭合的代码块 ---
  // 统计 ``` 出现次数；奇数 → 补一个闭合
  const fenceCount = (text.match(/```/g) || []).length
  if (fenceCount % 2 === 1) {
    text += '\n```'
  }

  return text
}

/**
 * 渲染 Markdown 为安全 HTML
 */
export function renderMarkdown(content) {
  const pre = preprocessStreamingMarkdown(content)
  const rawHtml = marked.parse(pre)

  // DOMPurify 白名单：
  // - 允许代码块相关的 pre/code/span（hljs 靠 span.class 上色）
  // - 允许 class 属性（不允许就没法高亮）
  // - 彻底剥离 on* 事件、script、iframe 等
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'span', 'div',
      'blockquote', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt'],
  })
}

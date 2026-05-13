import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
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

const renderer = new marked.Renderer()
renderer.code = function (code, lang) {
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

function preprocessStreamingMarkdown(raw) {
  if (!raw) return ''

  let text = raw

  const wholeFenceMatch = text.match(
    /^\s*```(?:markdown|md|text|plain)?\s*\n([\s\S]*?)\n```\s*$/i
  )
  if (wholeFenceMatch) {
    text = wholeFenceMatch[1]
  }

  const fenceCount = (text.match(/```/g) || []).length
  if (fenceCount % 2 === 1) {
    text += '\n```'
  }

  return text
}

export function renderMarkdown(content) {
  const pre = preprocessStreamingMarkdown(content)
  const rawHtml = marked.parse(pre)

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

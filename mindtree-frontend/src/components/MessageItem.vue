<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps({
  message: { type: Object, required: true },
  // 是否是"正在流式输出"的那条（用来显示打字光标）
  isStreaming: { type: Boolean, default: false },
})

const isUser = computed(() => props.message.role === 'user')

// 用户消息不渲染 markdown，避免用户输入的 * 被当成斜体
// AI 消息走 markdown + XSS 过滤
const renderedContent = computed(() => {
  if (isUser.value) return props.message.content
  return renderMarkdown(props.message.content)
})

// 空内容 + 正在流式 = 显示"思考中"占位
const showThinking = computed(() => {
  return !isUser.value && props.isStreaming && !props.message.content
})

function formatScore(score) {
  if (typeof score !== 'number') return ''
  return score.toFixed(2)
}
</script>

<template>
  <div class="msg-row" :class="{ 'msg-row--user': isUser }">
    <!-- AI 头像 -->
    <div v-if="!isUser" class="avatar">
      <AppIcon :size="22" />
    </div>

    <!-- 气泡 -->
    <div class="bubble" :class="{ 'bubble--user': isUser }">
      <!-- 思考中占位 -->
      <div v-if="showThinking" class="thinking">
        <span class="dot" /><span class="dot" /><span class="dot" />
      </div>

      <!-- 用户消息：纯文本，保留换行 -->
      <div v-else-if="isUser" class="text-plain">{{ renderedContent }}</div>

      <!-- AI 消息：markdown 渲染后的 HTML -->
      <div
        v-else
        class="markdown-body"
        v-html="renderedContent"
      />

      <!-- 流式光标 -->
      <span v-if="isStreaming && !isUser && message.content" class="cursor" />

      <section v-if="!isUser && message.tools?.length" class="agent-panel">
        <div class="agent-panel__head">
          <strong>工具调用</strong>
          <span>{{ message.tools.length }} 次</span>
        </div>
        <article v-for="tool in message.tools" :key="tool.id" class="tool-card">
          <div class="tool-card__top">
            <strong>{{ tool.name }}</strong>
            <span :class="['tool-status', `tool-status--${tool.status}`]">{{ tool.status }}</span>
          </div>
          <pre>{{ JSON.stringify(tool.args || {}, null, 2) }}</pre>
          <p v-if="tool.result">{{ tool.result }}</p>
        </article>
      </section>

      <section v-if="!isUser && message.citations?.length" class="agent-panel">
        <div class="agent-panel__head">
          <strong>参考来源</strong>
          <span>{{ message.citations.length }} 条命中</span>
        </div>
        <article v-for="citation in message.citations" :key="citation.id" class="source-card">
          <div class="source-card__top">
            <strong>{{ citation.title }}</strong>
            <span v-if="formatScore(citation.score)">相关度 {{ formatScore(citation.score) }}</span>
          </div>
          <p>{{ citation.snippet }}</p>
          <small>{{ citation.source }}</small>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.msg-row {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  align-items: flex-start;
}
.msg-row--user {
  flex-direction: row-reverse;
}

.avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.bubble {
  max-width: 78%;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--ai-bubble);
  color: var(--text-primary);
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  font-size: 15px;
  line-height: 1.75;
  word-break: break-word;
}
.bubble--user {
  background: var(--user-bubble);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 10px rgba(166, 139, 110, 0.2);
}

.text-plain {
  white-space: pre-wrap;
}

/* 用户气泡里的 Markdown 默认样式需要覆盖（虽然现在不渲染 markdown，但保险起见） */
.bubble--user :deep(.markdown-body) {
  color: #fff;
}

/* 思考中的三个点 */
.thinking {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-light);
  animation: bounce 1.2s infinite ease-in-out;
}
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
  30% { transform: translateY(-4px); opacity: 1; }
}

/* 打字光标 */
.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--accent);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.9s steps(2, start) infinite;
}
@keyframes blink {
  to { visibility: hidden; }
}

.agent-panel {
  margin-top: 12px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-panel__head,
.tool-card__top,
.source-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.agent-panel__head strong {
  font-size: 13px;
  color: var(--text-primary);
}

.agent-panel__head span,
.source-card__top span {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.tool-card,
.source-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-tertiary);
  padding: 9px 10px;
}

.tool-card__top strong,
.source-card__top strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--text-primary);
}

.tool-status {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 2px 7px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
}

.tool-status--success {
  color: #5f7f48;
}

.tool-status--error {
  color: var(--danger);
}

.tool-status--running {
  color: var(--accent);
}

.tool-card pre {
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.tool-card p,
.source-card p {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.source-card small {
  display: block;
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
}
</style>

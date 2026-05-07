<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

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
</script>

<template>
  <div class="msg-row" :class="{ 'msg-row--user': isUser }">
    <!-- AI 头像 -->
    <div v-if="!isUser" class="avatar">
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
        <path d="M16 24 L16 15" stroke="#8b7355" stroke-width="2" stroke-linecap="round" fill="none"/>
        <circle cx="16" cy="12" r="5" fill="#a68b6e"/>
        <circle cx="11" cy="14" r="3.5" fill="#c2a783"/>
        <circle cx="21" cy="14" r="3.5" fill="#c2a783"/>
        <circle cx="16" cy="9" r="3.5" fill="#d9c7ae"/>
      </svg>
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
</style>

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

const sources = computed(() => {
  return Array.isArray(props.message.sources) ? props.message.sources : []
})
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

      <details v-if="!isUser && sources.length" class="sources">
        <summary>相关心情日志 {{ sources.length }} 条</summary>
        <div class="sources__list">
          <div
            v-for="source in sources"
            :key="source.sourcePath || source.sourceName"
            class="sources__item"
          >
            <div class="sources__title">{{ source.title || source.sourceName }}</div>
            <div class="sources__meta">{{ source.sourceRelPath || source.sourceName }}</div>
          </div>
        </div>
      </details>

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
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(255, 250, 245, 0.88);
  border: 1px solid rgba(186, 168, 155, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  box-shadow: var(--shadow);
}

.bubble {
  max-width: 78%;
  padding: 15px 19px;
  border-radius: 20px;
  background: var(--ai-bubble);
  color: var(--text-primary);
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  font-size: 15px;
  line-height: 1.88;
  word-break: break-word;
}
.bubble--user {
  background: linear-gradient(135deg, #cbb093 0%, #b99674 100%);
  color: var(--user-bubble-text);
  border-color: rgba(160, 131, 100, 0.2);
  box-shadow: 0 10px 24px rgba(163, 132, 100, 0.22);
}

.text-plain {
  white-space: pre-wrap;
}

.sources {
  margin-top: 10px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.sources summary {
  cursor: pointer;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.4;
}
.sources__list {
  margin-top: 8px;
  display: grid;
  gap: 6px;
}
.sources__item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(240, 233, 225, 0.78);
}
.sources__title {
  font-size: 12.5px;
  line-height: 1.35;
  color: var(--text-primary);
  font-weight: 500;
}
.sources__meta {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-tertiary);
  overflow-wrap: anywhere;
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

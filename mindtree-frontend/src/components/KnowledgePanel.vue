<script setup>
defineProps({
  documents: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  notice: { type: String, default: '' },
  error: { type: String, default: '' },
  ragEnabled: { type: Boolean, default: true },
  retrievalMode: { type: String, default: 'keyword' },
})

const emit = defineEmits(['upload', 'remove', 'clear', 'toggle-rag'])

function handleFiles(event) {
  const input = event.target
  if (input.files?.length) {
    emit('upload', input.files)
    input.value = ''
  }
}

function formatTime(time) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(time)
}
</script>

<template>
  <section class="knowledge">
    <div class="knowledge__head">
      <div>
        <div class="knowledge__label">Agent 知识库</div>
        <h2>资料检索</h2>
      </div>
      <span class="knowledge__count">{{ documents.length }} 份</span>
    </div>

    <div class="knowledge__toolbar">
      <button
        class="rag-toggle"
        :class="{ 'rag-toggle--active': ragEnabled }"
        type="button"
        @click="emit('toggle-rag')"
      >
        {{ ragEnabled ? 'RAG 开' : 'RAG 关' }}
      </button>
      <span class="mode">{{ retrievalMode === 'embedding' ? '向量检索' : '关键词检索' }}</span>
    </div>

    <label class="upload">
      <input
        accept=".md,.markdown,.txt,.json"
        multiple
        type="file"
        :disabled="loading"
        @change="handleFiles"
      >
      <span>{{ loading ? '处理中...' : '上传资料' }}</span>
      <small>支持 md / txt / json，回答时自动检索并展示引用。</small>
    </label>

    <div v-if="notice" class="knowledge__notice">{{ notice }}</div>
    <div v-if="error" class="knowledge__error">{{ error }}</div>

    <div v-if="documents.length" class="docs">
      <article v-for="doc in documents" :key="doc.id" class="doc">
        <div class="doc__main">
          <strong :title="doc.name">{{ doc.name }}</strong>
          <span>{{ formatTime(doc.createdAt) }}</span>
        </div>
        <button title="移除" :disabled="loading" @click="emit('remove', doc.id)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7 L20 7 M9 7 L9 4 L15 4 L15 7 M6 7 L7 20 L17 20 L18 7"/>
          </svg>
        </button>
      </article>
    </div>

    <p v-else class="empty">暂无资料。上传后，MindTree 会先检索相关片段，再组织回复。</p>

    <button
      v-if="documents.length"
      class="clear"
      type="button"
      :disabled="loading"
      @click="emit('clear')"
    >
      清空知识库
    </button>
  </section>
</template>

<style scoped>
.knowledge {
  margin: 8px 14px 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.knowledge__head,
.knowledge__toolbar,
.doc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.knowledge__label {
  color: var(--text-tertiary);
  font-size: 11px;
}

.knowledge h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.knowledge__count,
.mode {
  color: var(--text-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.rag-toggle {
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 9px;
}

.rag-toggle--active {
  background: var(--accent);
  color: var(--user-bubble-text);
  border-color: var(--accent);
}

.upload {
  border: 1px dashed var(--accent-light);
  border-radius: 8px;
  padding: 10px;
  background: var(--accent-soft);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.upload input {
  display: none;
}

.upload span {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.upload small,
.empty {
  color: var(--text-tertiary);
  font-size: 11.5px;
  line-height: 1.5;
}

.knowledge__notice,
.knowledge__error {
  border-radius: 7px;
  font-size: 11.5px;
  line-height: 1.5;
  padding: 7px 8px;
  white-space: pre-wrap;
}

.knowledge__notice {
  background: var(--accent-soft);
  color: var(--text-secondary);
}

.knowledge__error {
  background: #fdecea;
  color: #a6584e;
}

.docs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 210px;
  overflow: auto;
}

.doc {
  border-radius: 8px;
  background: var(--bg-tertiary);
  padding: 8px;
}

.doc__main {
  min-width: 0;
}

.doc strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 12.5px;
}

.doc span {
  display: block;
  color: var(--text-tertiary);
  font-size: 11px;
}

.doc button {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
}

.doc button:hover {
  background: rgba(194, 117, 106, 0.12);
  color: var(--danger);
}

.clear {
  width: 100%;
  border-radius: 8px;
  padding: 8px;
  color: var(--danger);
  background: transparent;
  border: 1px solid rgba(194, 117, 106, 0.3);
  font-size: 12px;
}

.clear:hover:not(:disabled) {
  background: rgba(194, 117, 106, 0.1);
}
</style>

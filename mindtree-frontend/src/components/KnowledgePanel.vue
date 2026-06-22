<script setup>
import { computed, onMounted, ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { usePreferencesStore } from '@/stores/preferences'
import {
  clearKnowledgeVault,
  fetchKnowledgeStatus,
  generateReview,
  indexKnowledgeVault,
  saveKnowledgeVault,
  writeReview,
} from '@/api/chat'

const store = useChatStore()
const prefs = usePreferencesStore()

const expanded = ref(false)
const loading = ref(false)
const indexing = ref(false)
const reviewing = ref(false)
const writing = ref(false)
const clearing = ref(false)
const error = ref('')
const notice = ref('')
const status = ref(null)
const vaultName = ref('')
const vaultPath = ref('')
const review = ref(null)

const isIndexed = computed(() => Boolean(status.value?.index?.indexed))
const hasVault = computed(() => Boolean(status.value?.vault?.path))
const canUseKnowledge = computed(() => isIndexed.value && hasVault.value)
const isStale = computed(() => Boolean(status.value?.index?.stale))

const statusText = computed(() => {
  if (!hasVault.value) return '未配置，可展开填写路径'
  if (isStale.value) return '路径已更换，请重新导入'
  if (!isIndexed.value) return '已保存路径，等待导入'
  return `${status.value.index.fileCount} 文件 / ${status.value.index.docCount} 片段`
})

const pathHint = computed(() => {
  if (!hasVault.value) return '还没有绑定 Obsidian / Markdown 文件夹'
  return status.value?.vault?.path || ''
})

function activeApiMessages() {
  return store.activeMessages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .filter(message => message.content?.trim())
    .map(message => ({ role: message.role, content: message.content }))
}

function setError(message) {
  error.value = message || ''
  if (message) notice.value = ''
}

function setNotice(message) {
  notice.value = message || ''
  if (message) error.value = ''
}

async function refresh() {
  loading.value = true
  try {
    const data = await fetchKnowledgeStatus()
    status.value = data
    vaultName.value = data.vault?.name || ''
    vaultPath.value = data.vault?.path || ''
    if (!data.index?.indexed && prefs.useKnowledge) prefs.setUseKnowledge(false)
  } catch (err) {
    setError(err.message || '读取知识库状态失败')
  } finally {
    loading.value = false
  }
}

async function saveVault() {
  if (!vaultPath.value.trim()) {
    setError('请填写 Obsidian 或 Markdown 文件夹路径')
    return
  }

  loading.value = true
  try {
    await saveKnowledgeVault({
      name: vaultName.value.trim(),
      path: vaultPath.value.trim(),
    })
    prefs.setUseKnowledge(false)
    setNotice('路径已保存。更换路径后需要点击“重新导入”。')
    await refresh()
  } catch (err) {
    setError(err.message || '保存失败')
  } finally {
    loading.value = false
  }
}

async function runIndex() {
  indexing.value = true
  try {
    const result = await indexKnowledgeVault()
    setNotice(`已导入 ${result.fileCount} 个文件，生成 ${result.fragments} 个片段`)
    await refresh()
  } catch (err) {
    setError(err.message || '导入失败')
  } finally {
    indexing.value = false
  }
}

async function clearVault() {
  if (!confirm('确定要清空当前心情库路径和索引吗？不会删除你的原始 Markdown 文件。')) return
  clearing.value = true
  try {
    await clearKnowledgeVault()
    prefs.setUseKnowledge(false)
    vaultName.value = ''
    vaultPath.value = ''
    setNotice('已清空路径和索引，可以重新填写路径。')
    await refresh()
    expanded.value = true
  } catch (err) {
    setError(err.message || '清空失败')
  } finally {
    clearing.value = false
  }
}

function toggleKnowledge(event) {
  const enabled = event.target.checked
  if (enabled && !canUseKnowledge.value) {
    prefs.setUseKnowledge(false)
    expanded.value = true
    setError('需要先配置并导入 Obsidian / Markdown 文件夹')
    return
  }
  prefs.setUseKnowledge(enabled)
}

async function createReview() {
  const messages = activeApiMessages()
  if (messages.length <= 1) {
    setError('当前会话内容太少，先聊几句再生成复盘')
    return
  }

  reviewing.value = true
  try {
    review.value = await generateReview({
      messages,
      useKnowledge: prefs.useKnowledge,
      topK: prefs.knowledgeTopK,
    })
    setNotice('复盘已生成，可写回 Obsidian')
  } catch (err) {
    setError(err.message || '生成复盘失败')
  } finally {
    reviewing.value = false
  }
}

async function writeBack() {
  if (!review.value?.content) return

  writing.value = true
  try {
    const result = await writeReview({
      title: review.value.title,
      content: review.value.content,
      sources: review.value.sources || [],
    })
    setNotice(`已写回：${result.relativePath}`)
  } catch (err) {
    setError(err.message || '写回失败')
  } finally {
    writing.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <section class="knowledge">
    <div class="knowledge__bar">
      <button
        class="knowledge__toggle"
        type="button"
        :title="expanded ? '收起路径设置' : '展开路径设置 / 重新导入'"
        @click="expanded = !expanded"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path :d="expanded ? 'M6 15 L12 9 L18 15' : 'M6 9 L12 15 L18 9'" />
        </svg>
      </button>

      <button class="knowledge__status" type="button" @click="expanded = !expanded">
        <span class="knowledge__dot" :class="{ 'knowledge__dot--ready': canUseKnowledge }" />
        <span>心情库：{{ statusText }}</span>
      </button>

      <button class="change-btn" type="button" @click="expanded = true">更换路径</button>

      <label class="switch">
        <input
          type="checkbox"
          :checked="prefs.useKnowledge"
          :disabled="store.isGenerating"
          @change="toggleKnowledge"
        />
        <span class="switch__track" />
        <span class="switch__label">检索</span>
      </label>
    </div>

    <transition name="fade">
      <div v-if="expanded" class="knowledge__body">
        <div class="current-path">
          <span class="current-path__label">当前路径</span>
          <span class="current-path__text">{{ pathHint }}</span>
        </div>

        <div class="vault-row">
          <input
            v-model="vaultName"
            class="vault-row__name"
            placeholder="库名称，可不填"
            :disabled="loading || indexing"
          />
          <textarea
            v-model="vaultPath"
            class="vault-row__path"
            placeholder="粘贴你的 Obsidian 库或 Markdown 文件夹路径，例如 /Users/你的名字/Documents/Obsidian/Mood"
            :disabled="loading || indexing"
            rows="2"
          />
        </div>

        <div class="path-actions">
          <button class="small-btn" :disabled="loading || indexing" @click="saveVault">
            保存路径
          </button>
          <button class="small-btn small-btn--primary" :disabled="loading || indexing || !hasVault" @click="runIndex">
            {{ indexing ? '导入中' : '重新导入' }}
          </button>
          <button class="small-btn small-btn--ghost" :disabled="clearing || indexing" @click="clearVault">
            {{ clearing ? '清空中' : '清空配置' }}
          </button>
        </div>

        <div class="tools-row">
          <label class="topk">
            <span>Top K</span>
            <input type="range" min="1" max="12" :value="prefs.knowledgeTopK" @input="prefs.setKnowledgeTopK($event.target.value)" />
            <strong>{{ prefs.knowledgeTopK }}</strong>
          </label>

          <button class="small-btn" :disabled="reviewing || store.isGenerating" @click="createReview">
            {{ reviewing ? '生成中' : '生成心理复盘' }}
          </button>
          <button class="small-btn small-btn--primary" :disabled="writing || !review?.content || !hasVault" @click="writeBack">
            {{ writing ? '写回中' : '写回 Obsidian' }}
          </button>
        </div>

        <transition name="fade"><div v-if="error" class="panel-msg panel-msg--error">{{ error }}</div></transition>
        <transition name="fade"><div v-if="notice" class="panel-msg">{{ notice }}</div></transition>

        <details v-if="review?.content" class="review-preview" open>
          <summary>心理复盘预览</summary>
          <pre>{{ review.content }}</pre>
        </details>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.knowledge {
  max-width: 780px;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px 10px;
}

.knowledge__bar {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 250, 245, 0.78);
  padding: 7px 10px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.knowledge__toggle {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  color: var(--text-secondary);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.knowledge__toggle:hover { color: var(--text-primary); background: rgba(238, 230, 223, 0.92); }

.knowledge__status {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  background: transparent;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}
.knowledge__status span:last-child { overflow: hidden; text-overflow: ellipsis; }

.knowledge__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
}
.knowledge__dot--ready { background: #9daa93; }

.change-btn {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(238, 230, 223, 0.72);
  border: 1px solid rgba(186, 168, 155, 0.22);
  color: var(--text-secondary);
  font-size: 12px;
}
.change-btn:hover { background: rgba(238, 230, 223, 0.96); color: var(--text-primary); }

.switch {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.switch input { display: none; }
.switch__track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: rgba(186, 168, 155, 0.28);
  transition: background 0.2s;
}
.switch__track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fffaf5;
  box-shadow: 0 2px 5px rgba(0,0,0,0.12);
  transition: transform 0.2s;
}
.switch input:checked + .switch__track { background: #b89a79; }
.switch input:checked + .switch__track::after { transform: translateX(14px); }

.knowledge__body {
  margin-top: 10px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: rgba(255, 250, 245, 0.86);
  padding: 14px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.current-path {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
  margin-bottom: 10px;
  color: var(--text-secondary);
  font-size: 12.5px;
}
.current-path__label { color: var(--text-tertiary); white-space: nowrap; }
.current-path__text { overflow-wrap: anywhere; line-height: 1.55; }

.vault-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 8px;
}
.vault-row input,
.vault-row textarea {
  width: 100%;
  border: 1px solid rgba(186, 168, 155, 0.26);
  border-radius: 12px;
  background: rgba(255, 253, 249, 0.85);
  padding: 9px 11px;
  color: var(--text-primary);
  font-size: 13px;
}
.vault-row textarea {
  min-height: 46px;
  resize: vertical;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.vault-row input::placeholder,
.vault-row textarea::placeholder { color: var(--text-tertiary); }

.path-actions,
.tools-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.small-btn {
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(238, 230, 223, 0.82);
  border: 1px solid rgba(186, 168, 155, 0.22);
  color: var(--text-secondary);
  font-size: 12.5px;
}
.small-btn:hover:not(:disabled) { background: rgba(238, 230, 223, 0.98); color: var(--text-primary); }
.small-btn--primary {
  background: #b89a79;
  color: #fffaf5;
  border-color: transparent;
}
.small-btn--primary:hover:not(:disabled) { background: #aa8a68; color: #fffaf5; }
.small-btn--ghost { background: transparent; }

.topk {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.topk input { accent-color: #b89a79; }
.topk strong { color: var(--accent-strong); }

.panel-msg {
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: 12px;
  background: rgba(223, 230, 220, 0.72);
  color: #6f7d68;
  font-size: 12.5px;
  overflow-wrap: anywhere;
}
.panel-msg--error {
  background: rgba(242, 230, 227, 0.84);
  color: #986d65;
}

.review-preview {
  margin-top: 10px;
  border: 1px solid rgba(186, 168, 155, 0.22);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 253, 249, 0.78);
}
.review-preview summary {
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
}
.review-preview pre {
  margin-top: 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.75;
}

@media (max-width: 700px) {
  .knowledge { padding: 0 14px 10px; }
  .vault-row { grid-template-columns: 1fr; }
  .change-btn { display: none; }
}
</style>

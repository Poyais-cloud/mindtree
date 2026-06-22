<script setup>
import { ref, nextTick, watch, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'

const props = defineProps({
  prefill: { type: String, default: '' },
})
const emit = defineEmits(['send', 'stop'])

const store = useChatStore()
const text = ref('')
const textareaRef = ref(null)

const {
  isSupported: speechSupported,
  isListening,
  transcript,
  interimTranscript,
  error: speechError,
  start: startSpeech,
  stop: stopSpeech,
  clear: clearSpeech,
} = useSpeechRecognition({ lang: 'zh-CN' })

watch(transcript, (newTranscript, oldTranscript) => {
  const diff = newTranscript.slice(oldTranscript?.length || 0)
  if (diff) {
    text.value += diff
    nextTick(autoResize)
  }
})

const displayHint = computed(() => {
  if (isListening.value && interimTranscript.value) {
    return interimTranscript.value
  }
  return ''
})

function toggleSpeech() {
  if (!speechSupported) {
    alert('当前浏览器不支持语音识别，推荐使用 Chrome 或 Edge')
    return
  }
  if (isListening.value) {
    stopSpeech()
  } else {
    clearSpeech()
    startSpeech()
  }
}

let isComposing = false
function onCompositionStart() { isComposing = true }
function onCompositionEnd()   { isComposing = false }

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 140) + 'px'
}

watch(text, () => nextTick(autoResize))

watch(() => props.prefill, (v) => {
  if (v) {
    text.value = v
    nextTick(() => {
      textareaRef.value?.focus()
      autoResize()
    })
  }
})

function handleSend() {
  const content = text.value.trim()
  if (!content || store.isGenerating) return
  if (isListening.value) stopSpeech()
  emit('send', content)
  text.value = ''
  nextTick(autoResize)
}

function handleKeydown(e) {
  if (isComposing) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleStop() { emit('stop') }
</script>

<template>
  <div class="input-wrap">
    <transition name="fade">
      <div v-if="speechError" class="speech-err">
        {{ speechError }}
        <button @click="speechError = null">×</button>
      </div>
    </transition>

    <div class="input-box" :class="{ 'input-box--recording': isListening }">
      <div v-if="isListening" class="rec-pulse" title="录音中">
        <span class="rec-dot" />
      </div>

      <div class="textarea-wrap">
        <textarea
          ref="textareaRef"
          v-model="text"
          class="input-textarea"
          :placeholder="isListening ? '正在识别语音' : '输入内容，Enter 发送，Shift + Enter 换行'"
          rows="1"
          :disabled="store.isGenerating"
          @keydown="handleKeydown"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
        />
        <div v-if="displayHint" class="interim">{{ displayHint }}</div>
      </div>

      <button
        v-if="speechSupported && !store.isGenerating"
        class="btn-mic"
        :class="{ 'btn-mic--active': isListening }"
        :title="isListening ? '停止录音' : '语音输入'"
        @click="toggleSpeech"
      >
        <svg v-if="!isListening" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="3" width="6" height="12" rx="3"/>
          <path d="M5 11 Q5 19 12 19 Q19 19 19 11 M12 19 L12 22 M8 22 L16 22"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16">
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
        </svg>
      </button>

      <button
        v-if="store.isGenerating"
        class="btn-action btn-action--stop"
        title="停止生成"
        @click="handleStop"
      >
        <svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>
      </button>
      <button
        v-else
        class="btn-action btn-action--send"
        :disabled="!text.trim()"
        title="发送"
        @click="handleSend"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12 L19 12 M13 6 L19 12 L13 18"/>
        </svg>
      </button>
    </div>

    <div class="input-hint">
      本工具仅用于情绪支持和记录，不构成医疗建议。
    </div>
  </div>
</template>

<style scoped>
.input-wrap {
  max-width: 780px;
  margin: 0 auto;
  width: 100%;
  padding: 0 24px 18px;
}

.speech-err {
  background: rgba(242, 230, 227, 0.92);
  border: 1px solid rgba(191, 138, 132, 0.32);
  color: #926760;
  font-size: 12.5px;
  padding: 6px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.speech-err button {
  background: transparent;
  color: inherit;
  font-size: 16px;
}

.input-box {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background: rgba(255, 250, 245, 0.84);
  border: 1px solid var(--border);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 18px;
  padding: 10px 10px 10px 14px;
  box-shadow: var(--shadow);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-box:focus-within {
  border-color: var(--accent-light);
  box-shadow: var(--shadow-strong);
}
.input-box--recording {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px rgba(194, 117, 106, 0.15);
}

.rec-pulse {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}
.rec-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
  animation: pulse 1.2s infinite;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

.textarea-wrap {
  flex: 1;
  position: relative;
}
.input-textarea {
  width: 100%;
  font-size: 15px;
  line-height: 1.7;
  resize: none;
  max-height: 140px;
  color: var(--text-primary);
  padding: 4px 0;
  display: block;
}
.input-textarea::placeholder {
  color: var(--text-tertiary);
  white-space: normal;
}

.interim {
  font-size: 14px;
  color: var(--text-tertiary);
  font-style: italic;
  padding: 0;
  line-height: 1.5;
  opacity: 0.7;
}

.btn-mic {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
}
.btn-mic:hover {
  background: rgba(238, 230, 223, 0.9);
  color: var(--text-primary);
}
.btn-mic--active {
  background: var(--danger);
  color: #fff;
  border-color: var(--danger);
  animation: gentle-pulse 1.5s infinite;
}
@keyframes gentle-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(194, 117, 106, 0.35); }
  50%      { box-shadow: 0 0 0 6px rgba(194, 117, 106, 0); }
}

.btn-action {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.btn-action--send {
  background: linear-gradient(135deg, #b89a79 0%, #a88766 100%);
}
.btn-action--send:hover:not(:disabled) {
  filter: brightness(0.93);
  transform: scale(1.04);
}
.btn-action--send:disabled {
  background: #d8c8bb;
  opacity: 1;
}
.btn-action--stop {
  background: var(--danger);
}
.btn-action--stop:hover {
  filter: brightness(0.9);
}

.input-hint {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
  padding: 0 8px;
}

@media (max-width: 640px) {
  .input-wrap { padding: 0 14px 14px; }
}
</style>

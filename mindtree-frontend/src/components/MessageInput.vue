<script setup>
/**
 * 输入区组件 
 * - 语音输入（Web Speech API）—— mic 按钮长按 / 点击切换
 * - 录音中状态指示（脉冲动画 + 实时转写预览）
 * - 错误提示（权限拒绝、不支持等）
 *
 * 保留的交互要点:
 * 1. textarea 自适应高度
 * 2. Enter 发送 / Shift+Enter 换行
 * 3. 输入法 composition 处理（中文产品关键细节）
 * 4. 生成中变停止按钮
 */
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

// ========== 语音识别 ==========
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

// 语音识别出新的 final 结果时，追加到 textarea
watch(transcript, (newTranscript, oldTranscript) => {
  const diff = newTranscript.slice(oldTranscript?.length || 0)
  if (diff) {
    text.value += diff
    nextTick(autoResize)
  }
})

// 展示用的完整值 = textarea 当前值 + 当前中间结果（灰色提示）
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

// ========== 中文输入法处理 ==========
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
    <!-- 语音错误条 -->
    <transition name="fade">
      <div v-if="speechError" class="speech-err">
        🎙 {{ speechError }}
        <button @click="speechError = null">×</button>
      </div>
    </transition>

    <div class="input-box" :class="{ 'input-box--recording': isListening }">
      <!-- 录音中的脉冲指示 -->
      <div v-if="isListening" class="rec-pulse" title="录音中">
        <span class="rec-dot" />
      </div>

      <!-- 文本输入 + 中间结果悬浮提示 -->
      <div class="textarea-wrap">
        <textarea
          ref="textareaRef"
          v-model="text"
          class="input-textarea"
          :placeholder="isListening ? '正在听你说…' : '把心里的话说出来吧…… (Enter 发送, Shift + Enter 换行)'"
          rows="1"
          :disabled="store.isGenerating"
          @keydown="handleKeydown"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
        />
        <!-- 实时中间结果（灰色提示） -->
        <div v-if="displayHint" class="interim">{{ displayHint }}</div>
      </div>

      <!-- 麦克风按钮（仅在支持时显示） -->
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

      <!-- 发送 / 停止 -->
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
      此处对话仅供情绪陪伴，不构成医疗建议。如感到严重困扰，请联系专业人士。
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
  background: #fdecea;
  border: 1px solid #f5c6c0;
  color: #a6584e;
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
  background: var(--bg-secondary);
  border: 1px solid var(--border);
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
  background: var(--accent-soft);
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
  background: var(--accent);
}
.btn-action--send:hover:not(:disabled) {
  filter: brightness(0.93);
  transform: scale(1.04);
}
.btn-action--send:disabled {
  background: var(--accent-light);
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
  font-size: 11.5px;
  color: var(--text-tertiary);
  margin-top: 8px;
  padding: 0 8px;
}

@media (max-width: 640px) {
  .input-wrap { padding: 0 14px 14px; }
}
</style>

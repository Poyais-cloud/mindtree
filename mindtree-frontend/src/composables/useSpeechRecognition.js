import { ref, onUnmounted } from 'vue'

export function useSpeechRecognition({ lang = 'zh-CN' } = {}) {
  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  const isSupported = !!SpeechRecognition

  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref(null)

  let recognition = null

  function createInstance() {
    const inst = new SpeechRecognition()
    inst.lang = lang
    inst.continuous = true
    inst.interimResults = true
    inst.maxAlternatives = 1

    inst.onstart = () => {
      isListening.value = true
      error.value = null
    }

    inst.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += chunk
        } else {
          interimText += chunk
        }
      }
      if (finalText) transcript.value += finalText
      interimTranscript.value = interimText
    }

    inst.onerror = (event) => {
      const errMap = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许访问',
        'no-speech':   '没有检测到说话，再试一次？',
        'audio-capture': '找不到麦克风设备',
        'network':     '网络错误，语音识别暂不可用',
        'aborted':     null,
      }
      const msg = errMap[event.error]
      if (msg !== null) {
        error.value = msg !== undefined ? msg : `语音识别错误：${event.error}`
      }
      isListening.value = false
    }

    inst.onend = () => {
      isListening.value = false
      interimTranscript.value = ''
    }

    return inst
  }

  function start() {
    if (!isSupported) {
      error.value = '当前浏览器不支持语音识别，推荐使用 Chrome/Edge'
      return
    }
    if (isListening.value) return

    recognition = createInstance()
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null

    try {
      recognition.start()
    } catch (err) {
      console.warn('[Speech] start 失败', err)
      error.value = '启动语音识别失败，请稍后重试'
    }
  }

  function stop() {
    if (recognition && isListening.value) {
      try {
        recognition.stop()
      } catch {}
    }
  }

  function clear() {
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null
  }

  onUnmounted(() => {
    stop()
    recognition = null
  })

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    clear,
  }
}

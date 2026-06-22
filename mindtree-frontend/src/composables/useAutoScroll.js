import { ref, nextTick } from 'vue'

export function useAutoScroll(scrollTarget, options = {}) {
  const stickToBottom = ref(true)
  const threshold = options.threshold ?? 50

  function getScrollEl() {
    if (typeof scrollTarget === 'function') return scrollTarget()
    return scrollTarget?.value || null
  }

  function handleScroll() {
    const el = getScrollEl()
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.value = distanceToBottom < threshold
  }

  function scrollToBottom(force = false) {
    nextTick(() => {
      const el = getScrollEl()
      if (!el) return
      if (force || stickToBottom.value) {
        if (typeof options.scrollToBottom === 'function') {
          options.scrollToBottom(el)
        } else {
          el.scrollTop = el.scrollHeight
        }
      }
    })
  }

  return {
    stickToBottom,
    handleScroll,
    scrollToBottom,
  }
}

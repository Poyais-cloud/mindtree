/**
 * useAutoScroll —— 智能滚动跟随
 *
 * 面试重点:这是流式对话里最常被问的交互细节。
 *
 * 简单做法:每次内容更新直接 scrollTop = scrollHeight
 * 问题:用户往上翻历史消息时,会被强制拉到底部 → 体验糟糕
 *
 * 优化方案(本实现):
 * 1. 判断用户当前是否"在底部附近"(阈值 50px)
 * 2. 在底部才自动跟随
 * 3. 用户手动上滑就锁住,直到他自己滚回底部
 */
import { ref, nextTick } from 'vue'

export function useAutoScroll(containerRef) {
  // 记录用户是否"粘在底部"(默认是)
  const stickToBottom = ref(true)
  const THRESHOLD = 50 // 距离底部 50px 内算"在底部"

  /** 用户滚动事件的处理器 */
  function handleScroll() {
    const el = containerRef.value
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.value = distanceToBottom < THRESHOLD
  }

  /** 滚到底部(仅当处于跟随模式) */
  function scrollToBottom(force = false) {
    nextTick(() => {
      const el = containerRef.value
      if (!el) return
      if (force || stickToBottom.value) {
        el.scrollTop = el.scrollHeight
      }
    })
  }

  return {
    stickToBottom,
    handleScroll,
    scrollToBottom,
  }
}

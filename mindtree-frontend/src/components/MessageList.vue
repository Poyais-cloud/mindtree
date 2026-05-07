<script setup>
/**
 * MessageList 虚拟列表
 *
 * 技术选型：vue-virtual-scroller 的 DynamicScroller
 */
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useChatStore } from '@/stores/chat'
import MessageItem from './MessageItem.vue'

const store = useChatStore()

const scrollerRef = ref(null)
const stickToBottom = ref(true)
const SCROLL_THRESHOLD = 80

// DynamicScroller 会暴露 scrollToBottom() / scrollToItem() 方法
// 也会把实际的滚动元素作为 $el.firstChild 或通过 $refs.scroller.$el 拿到
function getScrollEl() {
  const inst = scrollerRef.value
  if (!inst) return null
  // DynamicScroller 的根 DOM 就是滚动容器
  return inst.$el
}

function handleScroll() {
  const el = getScrollEl()
  if (!el) return
  const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottom.value = distanceToBottom < SCROLL_THRESHOLD
}

function scrollToBottom(force = false) {
  nextTick(() => {
    const inst = scrollerRef.value
    if (!inst) return
    if (force || stickToBottom.value) {
      // vue-virtual-scroller 自带的方法
      if (typeof inst.scrollToBottom === 'function') {
        inst.scrollToBottom()
      } else {
        const el = inst.$el
        if (el) el.scrollTop = el.scrollHeight
      }
    }
  })
}

// 消息变化时自动滚（仅当用户"粘底"）
watch(
  () => store.activeMessages,
  () => scrollToBottom(),
  { deep: true, flush: 'post' }
)

// 切换会话时强制滚到底
watch(
  () => store.activeId,
  () => scrollToBottom(true)
)

onMounted(() => {
  const el = getScrollEl()
  if (el) el.addEventListener('scroll', handleScroll, { passive: true })
  scrollToBottom(true)
})

// 判断某条是否正在流式中
function isStreaming(index) {
  if (!store.isGenerating) return false
  const msgs = store.activeMessages
  if (index !== msgs.length - 1) return false
  return msgs[index].role === 'assistant'
}

// DynamicScroller 需要的最小项高度估计（用于未测量前的占位）
const MIN_ITEM_SIZE = 60
</script>

<template>
  <DynamicScroller
    ref="scrollerRef"
    :items="store.activeMessages"
    :min-item-size="MIN_ITEM_SIZE"
    key-field="id"
    class="msg-scroller"
    :buffer="400"
  >
    <template #default="{ item, index, active }">
      <!--
        DynamicScrollerItem 的关键 prop：
        - active: 是否在渲染窗口内
        - size-dependencies: 当这些值变化时，重新测量高度
          我们把 content 放进去，这样流式追加 token 时，
          当前项的缓存高度会失效并重新测量，布局就能跟上
      -->
      <DynamicScrollerItem
        :item="item"
        :active="active"
        :size-dependencies="[item.content]"
        :data-index="index"
      >
        <div class="msg-slot">
          <MessageItem
            :message="item"
            :is-streaming="isStreaming(index)"
          />
        </div>
      </DynamicScrollerItem>
    </template>
  </DynamicScroller>
</template>

<style scoped>
.msg-scroller {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 12px 0;
}

/* 居中约束：消息气泡最大 780px，但虚拟列表本身撑满宽度 */
.msg-slot {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 640px) {
  .msg-slot { padding: 0 16px; }
}
</style>

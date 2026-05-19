<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useChatStore } from '@/stores/chat'
import { useAutoScroll } from '@/composables/useAutoScroll'
import MessageItem from './MessageItem.vue'

const store = useChatStore()

const scrollerRef = ref(null)
const SCROLL_THRESHOLD = 80

function getScrollEl() {
  const inst = scrollerRef.value
  if (!inst) return null
  return inst.$el
}

const { handleScroll, scrollToBottom } = useAutoScroll(getScrollEl, {
  threshold: SCROLL_THRESHOLD,
  scrollToBottom: (el) => {
    const inst = scrollerRef.value
    if (typeof inst?.scrollToBottom === 'function') {
      inst.scrollToBottom()
    } else {
      el.scrollTop = el.scrollHeight
    }
  },
})

let scrollEl = null

watch(
  () => store.activeMessages,
  () => scrollToBottom(),
  { deep: true, flush: 'post' }
)

watch(
  () => store.activeId,
  () => scrollToBottom(true)
)

onMounted(() => {
  scrollEl = getScrollEl()
  if (scrollEl) scrollEl.addEventListener('scroll', handleScroll, { passive: true })
  scrollToBottom(true)
})

onUnmounted(() => {
  if (scrollEl) scrollEl.removeEventListener('scroll', handleScroll)
})

function isStreaming(index) {
  if (!store.isGenerating) return false
  const msgs = store.activeMessages
  if (index !== msgs.length - 1) return false
  return msgs[index].role === 'assistant'
}

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
      <DynamicScrollerItem
        :item="item"
        :active="active"
        :size-dependencies="[item.content, item.tools?.length, item.citations?.length]"
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

.msg-slot {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 640px) {
  .msg-slot { padding: 0 16px; }
}
</style>

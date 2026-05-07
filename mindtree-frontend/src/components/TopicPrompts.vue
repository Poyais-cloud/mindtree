<script setup>
/**
 * 话题引导组件
 *
 * 这是"场景化包装"的关键之一 —— 让用户一打开就知道可以聊什么，
 * 降低对话启动成本。普通 ChatGPT 套壳不会做这件事。
 *
 * 面试可以讲：
 * - 用户进入空白聊天框时的"冷启动"焦虑很常见
 * - 预设话题模板可以降低门槛，同时也暗示了产品边界（这是个情绪类产品）
 */
import { onMounted, ref, computed } from 'vue'
import { fetchTopics } from '@/api/chat'
import { useChatStore } from '@/stores/chat'

const emit = defineEmits(['select'])

const store = useChatStore()
const topics = ref({})

// 话题图标映射（emoji 作为视觉标识，不依赖图标库，轻量）
const TOPIC_META = {
  daily:        { icon: '🌿', label: '聊聊今天' },
  stress:       { icon: '🫧', label: '最近压力大' },
  relationship: { icon: '🤝', label: '人际困扰' },
  anxiety:      { icon: '🌙', label: '莫名焦虑' },
  sleep:        { icon: '🌸', label: '睡眠不好' },
}

// 仅在当前会话"几乎是空的"时显示（只有一条 AI 欢迎语）
const shouldShow = computed(() => store.activeMessages.length <= 1)

onMounted(async () => {
  topics.value = await fetchTopics()
})

function handlePick(key) {
  const prompt = topics.value[key]
  if (prompt) emit('select', prompt)
}
</script>

<template>
  <transition name="fade">
    <div v-if="shouldShow && Object.keys(topics).length" class="topics">
      <div class="topics__hint">不知道从哪说起？选一个话题吧</div>
      <div class="topics__list">
        <button
          v-for="(_, key) in topics"
          :key="key"
          class="topic-chip"
          @click="handlePick(key)"
        >
          <span class="topic-chip__icon">{{ TOPIC_META[key]?.icon || '💬' }}</span>
          <span>{{ TOPIC_META[key]?.label || key }}</span>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.topics {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 24px 12px;
}
.topics__hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 10px;
  padding-left: 4px;
}
.topics__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.topic-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 14px;
  color: var(--text-secondary);
}
.topic-chip:hover {
  background: var(--accent-soft);
  border-color: var(--accent-light);
  color: var(--text-primary);
  transform: translateY(-1px);
}
.topic-chip__icon {
  font-size: 15px;
}

@media (max-width: 640px) {
  .topics { padding: 0 16px 10px; }
}
</style>

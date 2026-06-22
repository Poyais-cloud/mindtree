<script setup>
import { onMounted, ref, computed } from 'vue'
import { fetchTopics } from '@/api/chat'
import { useChatStore } from '@/stores/chat'

const emit = defineEmits(['select'])

const store = useChatStore()
const topics = ref({})

const TOPIC_META = {
  daily:        { label: '今日状态' },
  stress:       { label: '压力事件' },
  relationship: { label: '人际关系' },
  anxiety:      { label: '焦虑感受' },
  sleep:        { label: '睡眠情况' },
}

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
      <div class="topics__hint">可以从这些轻一点的话题开始</div>
      <div class="topics__list">
        <button
          v-for="(_, key) in topics"
          :key="key"
          class="topic-chip"
          @click="handlePick(key)"
        >
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
  padding: 8px 12px;
  background: rgba(255, 250, 245, 0.72);
  border: 1px solid rgba(186, 168, 155, 0.24);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}
.topic-chip:hover {
  background: rgba(238, 230, 223, 0.92);
  border-color: var(--accent-light);
  color: var(--text-primary);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .topics { padding: 0 16px 10px; }
}
</style>

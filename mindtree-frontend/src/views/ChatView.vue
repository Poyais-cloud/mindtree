<script setup>
import { ref, computed, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useChat } from '@/composables/useChat'
import SessionSidebar from '@/components/SessionSidebar.vue'
import MessageList from '@/components/MessageList.vue'
import MessageInput from '@/components/MessageInput.vue'
import TopicPrompts from '@/components/TopicPrompts.vue'
import CrisisNotice from '@/components/CrisisNotice.vue'
import { analyzeCrisisText } from '@/utils/crisis'

const store = useChatStore()
const { error, sendMessage, stopGenerating } = useChat()

const sidebarCollapsed = ref(window.innerWidth < 768)

const prefill = ref('')
const crisis = ref(null)

function handleTopicSelect(text) {
  prefill.value = text
}

function handleSend(text) {
  prefill.value = ''
  crisis.value = analyzeCrisisText(text)
  sendMessage(text)
}

const activeTitle = computed(() => {
  const s = store.sessions.get(store.activeId)
  return s?.title || '智语心聊'
})

const knowledgeStatus = computed(() => {
  const rag = store.ragEnabled ? 'RAG 开' : 'RAG 关'
  return `${rag} · ${store.documents.length} 份资料`
})

onMounted(() => {
  store.refreshKnowledge()
})
</script>

<template>
  <div class="chat-layout">
    <SessionSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />

    <transition name="fade">
      <div
        v-if="!sidebarCollapsed"
        class="mobile-mask"
        @click="sidebarCollapsed = true"
      />
    </transition>

    <main class="main">
      <header class="main__head">
        <button
          v-if="sidebarCollapsed"
          class="menu-btn"
          title="打开侧边栏"
          @click="sidebarCollapsed = false"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7 L20 7 M4 12 L20 12 M4 17 L20 17"/>
          </svg>
        </button>
        <div class="main__title">{{ activeTitle }}</div>
        <button
          class="knowledge-chip"
          title="打开知识库"
          @click="sidebarCollapsed = false"
        >
          {{ knowledgeStatus }}
        </button>
      </header>

      <MessageList />

      <transition name="fade">
        <div v-if="error" class="error-bar">
          <span>{{ error }}</span>
          <button @click="error = null">×</button>
        </div>
      </transition>

      <CrisisNotice
        :visible="!!crisis"
        :level="crisis?.level"
        :keyword="crisis?.keyword"
        @close="crisis = null"
      />

      <TopicPrompts @select="handleTopicSelect" />

      <MessageInput
        :prefill="prefill"
        @send="handleSend"
        @stop="stopGenerating"
      />
    </main>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100%;
  background: var(--bg-primary);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.main__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}
.main__title {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: transparent;
}
.menu-btn:hover {
  background: var(--accent-soft);
}

.knowledge-chip {
  flex-shrink: 0;
  max-width: 150px;
  min-height: 32px;
  border-radius: 999px;
  padding: 0 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.knowledge-chip:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
  border-color: var(--accent-light);
}

.error-bar {
  max-width: 780px;
  margin: 0 auto 10px;
  padding: 10px 14px;
  background: #fdecea;
  border: 1px solid #f5c6c0;
  border-radius: 10px;
  color: #a6584e;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.error-bar button {
  background: transparent;
  color: #a6584e;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
}

.mobile-mask {
  display: none;
}

@media (max-width: 768px) {
  .mobile-mask {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 99;
  }
  .main__head { padding: 12px 14px; }
  .knowledge-chip {
    max-width: 112px;
  }
}
</style>

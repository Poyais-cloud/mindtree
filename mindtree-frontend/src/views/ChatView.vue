<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useChat } from '@/composables/useChat'
import SessionSidebar from '@/components/SessionSidebar.vue'
import MessageList from '@/components/MessageList.vue'
import MessageInput from '@/components/MessageInput.vue'
import TopicPrompts from '@/components/TopicPrompts.vue'
import CrisisNotice from '@/components/CrisisNotice.vue'
import KnowledgePanel from '@/components/KnowledgePanel.vue'
import WelcomePanel from '@/components/WelcomePanel.vue'
import AppIcon from '@/components/AppIcon.vue'
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

const showWelcome = computed(() => store.activeMessages.length === 0)
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
        <div class="main__title">
          <AppIcon :size="20" class="main__title-icon" />
          <span>{{ activeTitle }}</span>
        </div>
        <div class="main__head-spacer" />
      </header>

      <WelcomePanel v-if="showWelcome" />

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

      <KnowledgePanel />

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
  background: transparent;
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
  border-bottom: 1px solid rgba(186, 168, 155, 0.22);
  background: rgba(255, 250, 245, 0.66);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.main__title {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.main__title span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.main__title-icon {
  flex-shrink: 0;
}
.main__head-spacer {
  width: 32px;
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

.error-bar {
  max-width: 780px;
  margin: 0 auto 10px;
  padding: 10px 14px;
  background: rgba(242, 230, 227, 0.92);
  border: 1px solid rgba(191, 138, 132, 0.32);
  border-radius: 12px;
  color: #926760;
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
}
</style>

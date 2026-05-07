<script setup>
/**
 * 主聊天视图
 *
 * 组装层：只负责布局和把各组件的事件串起来。
 * 业务逻辑都在 useChat composable 里，这里只调用它。
 */
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useChat } from '@/composables/useChat'
import SessionSidebar from '@/components/SessionSidebar.vue'
import MessageList from '@/components/MessageList.vue'
import MessageInput from '@/components/MessageInput.vue'
import TopicPrompts from '@/components/TopicPrompts.vue'

const store = useChatStore()
const { error, sendMessage, stopGenerating } = useChat()

// 侧边栏折叠状态（移动端默认收起）
const sidebarCollapsed = ref(window.innerWidth < 768)

// 话题模板 → 输入框回填
const prefill = ref('')

function handleTopicSelect(text) {
  prefill.value = text
}

function handleSend(text) {
  prefill.value = ''
  sendMessage(text)
}

// 当前激活会话标题
const activeTitle = computed(() => {
  const s = store.sessions.get(store.activeId)
  return s?.title || '心灵树洞'
})
</script>

<template>
  <div class="chat-layout">
    <!-- 侧边栏 -->
    <SessionSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />

    <!-- 移动端遮罩 -->
    <transition name="fade">
      <div
        v-if="!sidebarCollapsed"
        class="mobile-mask"
        @click="sidebarCollapsed = true"
      />
    </transition>

    <!-- 主内容区 -->
    <main class="main">
      <!-- 顶部标题栏 -->
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
        <div class="main__head-spacer" />
      </header>

      <!-- 消息列表 -->
      <MessageList />

      <!-- 错误提示 -->
      <transition name="fade">
        <div v-if="error" class="error-bar">
          <span>⚠️ {{ error }}</span>
          <button @click="error = null">×</button>
        </div>
      </transition>

      <!-- 话题引导（仅在空会话时出现） -->
      <TopicPrompts @select="handleTopicSelect" />

      <!-- 输入框 -->
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
}
</style>

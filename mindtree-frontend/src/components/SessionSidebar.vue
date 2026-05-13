<script setup>
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { usePreferencesStore, THEMES } from '@/stores/preferences'
import AppIcon from '@/components/AppIcon.vue'

defineProps({
  collapsed: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])

const store = useChatStore()
const prefs = usePreferencesStore()
const renamingId = ref(null)
const renameBuf = ref('')

function handleNew() {
  if (store.isGenerating) return
  store.createSession()
}

function handleSwitch(id) {
  if (id === store.activeId) return
  store.switchSession(id)
}

function handleDelete(id, e) {
  e.stopPropagation()
  if (store.isGenerating && id === store.activeId) return
  if (!confirm('确定要删除这个对话吗？删除后无法恢复。')) return
  store.deleteSession(id)
}

function startRename(session, e) {
  e.stopPropagation()
  renamingId.value = session.id
  renameBuf.value = session.title
}

function finishRename() {
  if (renamingId.value && renameBuf.value.trim()) {
    store.renameSession(renamingId.value, renameBuf.value.trim().slice(0, 30))
  }
  renamingId.value = null
  renameBuf.value = ''
}
function cancelRename() {
  renamingId.value = null
  renameBuf.value = ''
}

function formatDate(ts) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar__head">
      <div class="logo">
        <AppIcon :size="24" />
        <span class="logo__text">智语心聊</span>
      </div>
      <button class="icon-btn icon-btn--toggle" title="收起" @click="emit('toggle')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M15 6 L9 12 L15 18"/>
        </svg>
      </button>
    </div>

    <button
      class="new-btn"
      :disabled="store.isGenerating"
      @click="handleNew"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 5 L12 19 M5 12 L19 12"/>
      </svg>
      <span>新建会话</span>
    </button>

    <div class="list">
      <div
        v-for="s in store.sessionList"
        :key="s.id"
        class="item"
        :class="{ 'item--active': s.id === store.activeId }"
        @click="handleSwitch(s.id)"
      >
        <input
          v-if="renamingId === s.id"
          v-model="renameBuf"
          class="item__rename"
          maxlength="30"
          autofocus
          @click.stop
          @blur="finishRename"
          @keydown.enter.prevent="finishRename"
          @keydown.esc.prevent="cancelRename"
        />
        <template v-else>
          <div class="item__title" :title="s.title">{{ s.title }}</div>
          <div class="item__meta">{{ formatDate(s.createdAt) }}</div>
          <div class="item__actions">
            <button class="icon-btn icon-btn--small" title="重命名" @click="startRename(s, $event)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M4 20 L9 19 L20 8 L16 4 L5 15 L4 20 Z"/>
              </svg>
            </button>
            <button class="icon-btn icon-btn--small icon-btn--danger" title="删除" @click="handleDelete(s.id, $event)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M4 7 L20 7 M9 7 L9 4 L15 4 L15 7 M6 7 L7 20 L17 20 L18 7"/>
              </svg>
            </button>
          </div>
        </template>
      </div>
    </div>

    <div class="sidebar__foot">
      <div class="theme-switcher" role="radiogroup" aria-label="主题切换">
        <button
          v-for="t in THEMES"
          :key="t.id"
          class="theme-btn"
          :class="{ 'theme-btn--active': prefs.theme === t.id }"
          :title="t.label"
          @click="prefs.setTheme(t.id)"
        >
          <span class="theme-btn__label">{{ t.label }}</span>
        </button>
      </div>
      <router-link to="/about" class="foot-link">关于项目</router-link>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease, margin-left 0.25s ease;
  overflow: hidden;
}
.sidebar--collapsed {
  width: 0;
  margin-left: -1px;
  border-right: none;
}

.sidebar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 10px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
}
.logo__text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: transparent;
}
.icon-btn:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}
.icon-btn--small {
  width: 24px;
  height: 24px;
}
.icon-btn--danger:hover {
  background: rgba(194, 117, 106, 0.12);
  color: var(--danger);
}

.new-btn {
  margin: 0 14px 8px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 500;
}
.new-btn:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: var(--accent-light);
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px;
}

.item {
  position: relative;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 2px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 46px;
  justify-content: center;
}
.item:hover { background: var(--accent-soft); }
.item--active {
  background: var(--bg-secondary);
  box-shadow: var(--shadow);
}
.item--active:hover { background: var(--bg-secondary); }

.item__title {
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 40px;
}
.item__meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.item__actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 2px;
}
.item:hover .item__actions,
.item--active .item__actions {
  display: flex;
}

.item__rename {
  width: 100%;
  padding: 4px 6px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 14px;
  border: 1px solid var(--accent-light);
}

.sidebar__foot {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-switcher {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}
.theme-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 4px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}
.theme-btn__label {
  white-space: nowrap;
}
.theme-btn:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}
.theme-btn--active {
  background: var(--accent);
  color: var(--user-bubble-text);
}
.theme-btn--active:hover {
  background: var(--accent);
  color: var(--user-bubble-text);
  filter: brightness(0.96);
}

.foot-link {
  font-size: 12.5px;
  color: var(--text-tertiary);
  text-decoration: none;
  text-align: center;
}
.foot-link:hover { color: var(--accent); }

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0; left: 0;
    height: 100%;
    z-index: 100;
    box-shadow: var(--shadow-strong);
  }
  .sidebar--collapsed {
    transform: translateX(-100%);
    width: 260px;
    margin-left: 0;
    border-right: 1px solid var(--border);
  }
}
</style>

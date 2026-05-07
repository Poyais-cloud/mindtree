<script setup>
/**
 * 根组件
 *
 * 做三件事：
 * 1. hydrate chat store（从 localStorage 恢复会话）
 * 2. 激活 preferences store（自动把 theme 写到 <html data-theme=...>）
 * 3. 用 Suspense 包裹路由视图，等异步组件加载完再显示
 *
 * Suspense + defineAsyncComponent：
 *   之前只用了路由懒加载（() => import(...)），
 *   但路由懒加载期间用户会看到白屏瞬间。
 *   Suspense 的 #fallback slot 可以显示加载状态，体验更好。
 */
import { onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { usePreferencesStore } from '@/stores/preferences'

const store = useChatStore()
// 实例化 preferences：内部的 watch(theme, ..., { immediate:true })
// 会自动把当前主题应用到 <html data-theme=...>
usePreferencesStore()

onMounted(() => {
  store.hydrate()
})
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <Suspense>
        <component :is="Component" />
        <template #fallback>
          <div class="app-loading">
            <div class="loader" />
          </div>
        </template>
      </Suspense>
    </transition>
  </router-view>
</template>

<style>
.app-loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loader {
  width: 32px;
  height: 32px;
  border: 3px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

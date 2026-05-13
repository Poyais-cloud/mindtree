<script setup>
import { onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { usePreferencesStore } from '@/stores/preferences'

const store = useChatStore()
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

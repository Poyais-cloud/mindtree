<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { usePreferencesStore } from '@/stores/preferences'

const store = useChatStore()
usePreferencesStore()
const route = useRoute()

const BACKGROUNDS = {
  chat: {
    image: '/images/bg-mint-garden.png',
    position: 'center center',
    opacity: 0.86,
    scale: 1.03,
    overlay: 'linear-gradient(90deg, rgba(246,241,235,.84) 0%, rgba(246,241,235,.56) 34%, rgba(246,241,235,.16) 68%, rgba(246,241,235,.42) 100%)',
    glow: 'rgba(201, 216, 192, 0.24)',
  },
  about: {
    image: '/images/bg-sea-window.png',
    position: 'center center',
    opacity: 0.86,
    scale: 1.02,
    overlay: 'linear-gradient(90deg, rgba(246,241,235,.82) 0%, rgba(246,241,235,.52) 34%, rgba(246,241,235,.18) 68%, rgba(246,241,235,.4) 100%)',
    glow: 'rgba(201, 221, 232, 0.28)',
  },
  fallback: {
    image: '/images/automemories-clear-sanctuary.png',
    position: 'center center',
    opacity: 0.82,
    scale: 1.05,
    mirror: true,
    overlay: 'linear-gradient(90deg, rgba(246,241,235,.84) 0%, rgba(246,241,235,.66) 28%, rgba(246,241,235,.26) 62%, rgba(246,241,235,.44) 100%)',
    glow: 'rgba(201, 221, 232, 0.2)',
  },
}

const routeBackground = computed(() => {
  if (route.path.startsWith('/about')) return BACKGROUNDS.about
  if (route.path.startsWith('/chat') || route.path === '/') return BACKGROUNDS.chat
  return BACKGROUNDS.fallback
})

const backgroundStyle = computed(() => ({
  '--route-bg-image': `url('${routeBackground.value.image}')`,
  '--route-bg-position': routeBackground.value.position,
  '--route-bg-opacity': routeBackground.value.opacity,
  '--route-bg-scale': routeBackground.value.scale,
  '--route-bg-transform': `${routeBackground.value.mirror ? 'scaleX(-1) ' : ''}scale(${routeBackground.value.scale})`,
  '--route-bg-overlay': routeBackground.value.overlay,
  '--route-bg-glow': routeBackground.value.glow,
}))

onMounted(() => {
  store.hydrate()
})
</script>

<template>
  <div class="app-shell" :style="backgroundStyle">
    <div class="route-bg" aria-hidden="true">
      <div class="route-bg__image" />
      <div class="route-bg__overlay" />
      <div class="route-bg__soft-light route-bg__soft-light--left" />
      <div class="route-bg__soft-light route-bg__soft-light--right" />
      <div class="route-bg__top" />
    </div>

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
  </div>
</template>

<style>
.app-shell {
  position: relative;
  min-height: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  background: #faf7f2;
}

.route-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background: #faf7f2;
}

.app-shell > :not(.route-bg) {
  position: relative;
  z-index: 1;
}

.route-bg__image {
  position: absolute;
  inset: 0;
  background-image: var(--route-bg-image);
  background-size: cover;
  background-position: var(--route-bg-position);
  opacity: var(--route-bg-opacity);
  transform: var(--route-bg-transform);
  transform-origin: center center;
  transition: background-image 0.35s ease, opacity 0.35s ease, transform 0.35s ease;
}

.route-bg__overlay {
  position: absolute;
  inset: 0;
  background-image: var(--route-bg-overlay);
}

.route-bg__soft-light {
  position: absolute;
  border-radius: 999px;
  filter: blur(54px);
}

.route-bg__soft-light--left {
  left: 3rem;
  top: 7rem;
  width: 20rem;
  height: 20rem;
  background: var(--route-bg-glow);
}

.route-bg__soft-light--right {
  right: 2rem;
  top: 6rem;
  width: 18rem;
  height: 18rem;
  background: rgba(255, 253, 247, 0.32);
}

.route-bg__top {
  position: absolute;
  inset: 0 0 auto;
  height: 22rem;
  background: radial-gradient(ellipse at top, rgba(255,255,255,.72), transparent 70%);
}

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

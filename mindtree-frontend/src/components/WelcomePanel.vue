<script setup>
import AppIcon from '@/components/AppIcon.vue'
</script>

<template>
  <section class="welcome-panel">
    <div class="welcome-card">
      <div class="welcome-card__icon">
        <AppIcon :size="66" alt="玉兰花图标" />
      </div>
      <div class="welcome-card__eyebrow">MindTree · 智语心聊</div>
      <h1 class="welcome-card__title">给此刻的自己，留一个柔软的落点</h1>
      <p class="welcome-card__desc">
        你可以从今天的状态、最近的压力、反复出现的焦虑，
        或者一段难以说清的人际感受开始。我会先陪你把它慢慢说清楚。
      </p>
      <div class="welcome-card__tags">
        <span>温和陪伴</span>
        <span>情绪梳理</span>
        <span>支持表达</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.welcome-panel {
  max-width: 780px;
  margin: 0 auto;
  width: 100%;
  padding: 30px 24px 18px;
}

.welcome-card {
  padding: 34px 32px 28px;
  border-radius: 26px;
  background: rgba(255, 250, 245, 0.76);
  border: 1px solid rgba(186, 168, 155, 0.22);
  box-shadow: var(--shadow-strong);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  text-align: center;
}

.welcome-card__icon {
  width: 94px;
  height: 94px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border-radius: 28px;
  background: rgba(255, 250, 245, 0.9);
  border: 1px solid rgba(186, 168, 155, 0.18);
  box-shadow: var(--shadow);
}

.welcome-card__eyebrow {
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.welcome-card__title {
  font-size: 26px;
  line-height: 1.45;
  color: var(--accent-strong);
  margin-bottom: 12px;
  font-weight: 600;
}

.welcome-card__desc {
  max-width: 560px;
  margin: 0 auto;
  font-size: 15px;
  line-height: 1.9;
  color: var(--text-secondary);
}

.welcome-card__tags {
  margin-top: 18px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.welcome-card__tags span {
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(238, 230, 223, 0.85);
  border: 1px solid rgba(186, 168, 155, 0.18);
  color: var(--text-secondary);
  font-size: 13px;
}

@media (max-width: 640px) {
  .welcome-panel {
    padding: 18px 16px 12px;
  }

  .welcome-card {
    padding: 26px 18px 22px;
    border-radius: 22px;
  }

  .welcome-card__title {
    font-size: 22px;
  }

  .welcome-card__desc {
    font-size: 14px;
  }
}
</style>

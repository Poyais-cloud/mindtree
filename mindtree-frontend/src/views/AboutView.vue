<script setup>
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
</script>

<template>
  <div class="about-page">
    <div class="about-card">
      <button class="back-btn" @click="router.push('/chat')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M15 6 L9 12 L15 18"/>
        </svg>
        <span>回到对话</span>
      </button>

      <div class="hero">
        <div class="hero__icon"><AppIcon :size="52" /></div>
        <h1>智语心聊</h1>
        <p class="subtitle">MindTree · 情绪记录与支持对话工具</p>
      </div>

      <section class="block">
        <h2>项目定位</h2>
        <p>
          智语心聊，英文名 MindTree，是一个基于大语言模型的情绪支持对话工具。
          它用于记录当前状态、梳理压力来源和获得基础陪伴式反馈，
          不提供诊断，也不替代专业心理咨询或医疗服务。
        </p>
      </section>

      <section class="block">
        <h2>主要能力</h2>
        <ul>
          <li>提供更自然、更温和的情绪支持对话</li>
          <li>支持压力、人际、焦虑、睡眠等起始话题</li>
          <li>可接入 Obsidian 心情库进行检索辅助</li>
          <li>支持生成心理复盘并写回本地心情库</li>
        </ul>
      </section>

      <section class="block block--warn">
        <h2>安全说明</h2>
        <p>
          如果你正在经历严重的情绪危机、自伤或自杀念头，
          请不要只依赖本工具，优先联系身边可信的人或专业机构。
        </p>
        <div class="hotlines">
          <div class="hotline">
            <strong>广东心理危机研究与干预中心</strong>
            <span>12356</span>
          </div>
          <div class="hotline">
            <strong>全国希望 24 热线</strong>
            <span>400-161-9995</span>
          </div>
          <div class="hotline">
            <strong>各地 12320 卫生热线</strong>
            <span>按 5 进入心理援助</span>
          </div>
        </div>
      </section>

      <section class="block">
        <h2>技术实现</h2>
        <p class="tech">
          Vue 3 · Pinia · Vite · SSE 流式传输 · Node.js 后端代理
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  height: 100%;
  padding: 40px 20px;
  overflow-y: auto;
  background: transparent;
}

.about-card {
  max-width: 720px;
  margin: 0 auto;
  background: rgba(255, 250, 245, 0.8);
  border-radius: 22px;
  padding: 36px 40px;
  box-shadow: var(--shadow-strong);
  border: 1px solid var(--border);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  background: transparent;
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 16px;
  margin-left: -10px;
}
.back-btn:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.hero {
  text-align: center;
  padding: 10px 0 30px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 28px;
}
.hero__icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  background: rgba(255, 250, 245, 0.72);
  border: 1px solid rgba(186, 168, 155, 0.22);
  box-shadow: var(--shadow);
}
.hero h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--accent-strong);
  margin: 14px 0 6px;
  letter-spacing: 1px;
}
.subtitle {
  color: var(--text-secondary);
  font-size: 15px;
}

.block { margin-bottom: 28px; }
.block h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-strong);
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}
.block p {
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.9;
}
.block ul {
  padding-left: 20px;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.9;
}
.block ul li::marker { color: var(--rose); }

.block--warn {
  background: rgba(242, 230, 227, 0.66);
  padding: 20px 22px;
  border-radius: 16px;
  border: 1px solid rgba(191, 138, 132, 0.24);
}
.block--warn h2 { color: var(--danger); }

.hotlines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}
.hotline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 250, 245, 0.72);
  border-radius: 12px;
  font-size: 14px;
  border: 1px solid rgba(186, 168, 155, 0.18);
}
.hotline strong { color: var(--text-primary); font-weight: 500; }
.hotline span { color: var(--accent-strong); font-weight: 600; }

.tech {
  font-size: 13px;
  color: var(--text-secondary);
  background: rgba(238, 230, 223, 0.72);
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(186, 168, 155, 0.18);
}

@media (max-width: 640px) {
  .about-card { padding: 24px 20px; }
  .hotline { flex-direction: column; gap: 2px; }
}
</style>

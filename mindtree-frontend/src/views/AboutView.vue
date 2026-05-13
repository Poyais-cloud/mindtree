<script setup>
import { useRouter } from 'vue-router'

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
        <svg viewBox="0 0 32 32" width="48" height="48" aria-hidden="true">
          <path d="M16 24 L16 15" stroke="#8b7355" stroke-width="2" stroke-linecap="round" fill="none"/>
          <circle cx="16" cy="12" r="5" fill="#a68b6e"/>
          <circle cx="11" cy="14" r="3.5" fill="#c2a783"/>
          <circle cx="21" cy="14" r="3.5" fill="#c2a783"/>
          <circle cx="16" cy="9" r="3.5" fill="#d9c7ae"/>
        </svg>
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
          <li>后端统一注入情绪支持类系统提示词</li>
          <li>提供压力、人际、焦虑、睡眠等起始话题</li>
          <li>检测明显危机表达并展示求助提示</li>
          <li>会话记录保存在当前浏览器本地</li>
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
  min-height: 100%;
  padding: 40px 20px;
  overflow-y: auto;
  background: var(--bg-primary);
}

.about-card {
  max-width: 680px;
  margin: 0 auto;
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 36px 40px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  background: transparent;
  padding: 6px 10px;
  border-radius: 6px;
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
.hero h1 {
  font-size: 26px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 14px 0 6px;
  letter-spacing: 1px;
}
.subtitle {
  color: var(--text-tertiary);
  font-size: 14px;
}

.block {
  margin-bottom: 26px;
}
.block h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}
.block p {
  color: var(--text-secondary);
  font-size: 14.5px;
  line-height: 1.8;
}
.block ul {
  padding-left: 20px;
  color: var(--text-secondary);
  font-size: 14.5px;
  line-height: 1.9;
}
.block ul li::marker {
  color: var(--accent-light);
}

.block--warn {
  background: #fdf6ec;
  padding: 18px 20px;
  border-radius: 10px;
  border-left: 3px solid var(--accent);
}
.block--warn h2 {
  color: var(--danger);
}

.hotlines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}
.hotline {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 14px;
}
.hotline strong {
  color: var(--text-primary);
  font-weight: 500;
}
.hotline span {
  color: var(--accent);
  font-weight: 600;
  font-family: monospace;
}

.tech {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 10px 14px;
  border-radius: 6px;
}

@media (max-width: 640px) {
  .about-card {
    padding: 24px 20px;
  }
  .hotline {
    flex-direction: column;
    gap: 2px;
  }
}
</style>

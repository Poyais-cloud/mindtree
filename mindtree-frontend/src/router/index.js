import { createRouter, createWebHistory } from 'vue-router'

// 懒加载 —— 这是首屏性能优化的关键之一,面试可以讲
// defineAsyncComponent 或路由懒加载,都是 Webpack/Vite 按需分包的基础
const ChatView = () => import('@/views/ChatView.vue')
const AboutView = () => import('@/views/AboutView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: ChatView, name: 'chat' },
    { path: '/about', component: AboutView, name: 'about' },
  ],
})

export default router

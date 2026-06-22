import { createRouter, createWebHistory } from 'vue-router'

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

/**
 * 偏好设置 Store —— 主题、字号等
 *
 * 独立于 chat store 是因为：
 * - 职责不同：chat 管对话数据，preferences 管用户偏好
 * - 持久化 key 不同：偏好一般不需要和会话一起迁移
 * - 分拆符合 Pinia 的 "一个 store 一个领域" 惯例
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'mindtree_preferences_v1'

export const THEMES = [
  { id: 'beige', label: '温暖米', emoji: '🌿' },
  { id: 'dark',  label: '夜间',   emoji: '🌙' },
  { id: 'blue',  label: '清晨',   emoji: '☀️' },
]

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {}
}

export const usePreferencesStore = defineStore('preferences', () => {
  const saved = loadPrefs()

  const theme = ref(saved.theme || 'beige')

  // 监听变化，自动落盘 + 应用到 <html data-theme=...>
  watch(
    theme,
    (newTheme) => {
      document.documentElement.setAttribute('data-theme', newTheme)
      savePrefs({ ...loadPrefs(), theme: newTheme })
    },
    { immediate: true }
  )

  function setTheme(id) {
    if (THEMES.some(t => t.id === id)) {
      theme.value = id
    }
  }

  function cycleTheme() {
    const idx = THEMES.findIndex(t => t.id === theme.value)
    const next = THEMES[(idx + 1) % THEMES.length]
    setTheme(next.id)
  }

  return { theme, setTheme, cycleTheme }
})

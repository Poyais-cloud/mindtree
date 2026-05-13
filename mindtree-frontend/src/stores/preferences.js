import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'mindtree_preferences_v1'

export const THEMES = [
  { id: 'beige', label: '浅色' },
  { id: 'dark',  label: '深色' },
  { id: 'blue',  label: '冷色' },
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

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'mindtree_preferences_v2'
const LOCKED_THEME = 'beige'

export const THEMES = [
  { id: LOCKED_THEME, label: '莫兰迪' },
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

  const theme = ref(LOCKED_THEME)
  const useKnowledge = ref(saved.useKnowledge || false)
  const knowledgeTopK = ref(saved.knowledgeTopK || 5)

  watch(
    [theme, useKnowledge, knowledgeTopK],
    ([, newUseKnowledge, newKnowledgeTopK]) => {
      theme.value = LOCKED_THEME
      document.documentElement.setAttribute('data-theme', LOCKED_THEME)
      savePrefs({
        theme: LOCKED_THEME,
        useKnowledge: Boolean(newUseKnowledge),
        knowledgeTopK: Math.max(1, Math.min(12, Number(newKnowledgeTopK) || 5)),
      })
    },
    { immediate: true }
  )

  function setTheme() {
    theme.value = LOCKED_THEME
  }

  function cycleTheme() {
    theme.value = LOCKED_THEME
  }

  function setUseKnowledge(enabled) {
    useKnowledge.value = Boolean(enabled)
  }

  function setKnowledgeTopK(value) {
    knowledgeTopK.value = Math.max(1, Math.min(12, Number(value) || 5))
  }

  return {
    theme,
    useKnowledge,
    knowledgeTopK,
    setTheme,
    cycleTheme,
    setUseKnowledge,
    setKnowledgeTopK,
  }
})

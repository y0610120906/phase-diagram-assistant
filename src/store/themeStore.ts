import { create } from 'zustand'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('phase-diagram-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return 'dark'
}

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.body.classList.add('light')
  } else {
    document.body.classList.remove('light')
  }
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme()
  applyTheme(initial)

  return {
    theme: initial,
    toggle: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      try { localStorage.setItem('phase-diagram-theme', next) } catch {}
      set({ theme: next })
    },
  }
})

import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const listeners = new Set<() => void>()
const read = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

/** Le thème initial est posé par le script de index.html ; ici on le bascule et on le mémorise. */
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem('numera-theme', theme)
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session.
  }
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore((cb) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, read)
}

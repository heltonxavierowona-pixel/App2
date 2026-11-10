import { useSyncExternalStore } from 'react'

/** Routeur minimal basé sur le hash : liens profonds et bouton retour sans dépendance. */
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
// Un hash qui ne commence pas par « / » (jetons de connexion renvoyés par e-mail) vaut l'accueil.
const read = () => {
  const hash = window.location.hash.replace(/^#/, '')
  return hash.startsWith('/') ? hash : '/'
}

export interface Route {
  path: string
  segments: string[]
  query: URLSearchParams
}

export function useRoute(): Route {
  const raw = useSyncExternalStore(subscribe, read)
  const [path, search = ''] = raw.split('?')
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(search) }
}

export function navigate(path: string, replace = false) {
  if (replace) window.location.replace(`#${path}`)
  else window.location.hash = path
}

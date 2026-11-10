import { useSyncExternalStore } from 'react'

/** Routeur minimal basé sur le hash : liens profonds et bouton retour sans dépendance. */
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const read = () => window.location.hash.replace(/^#/, '') || '/'

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

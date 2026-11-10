import type { ReactNode } from 'react'
import { useStore } from '../lib/store.tsx'
import { supabase } from '../lib/supabase.ts'
import { setTheme, useTheme } from '../lib/theme.ts'
import { Icon } from './ui.tsx'
import type { IconName } from './ui.tsx'

const NAV: { path: string; label: string; icon: IconName; root: string }[] = [
  { path: '/', label: 'Accueil', icon: 'home', root: '' },
  { path: '/commandes', label: 'Commandes', icon: 'orders', root: 'commandes' },
  { path: '/expeditions', label: 'Expéditions', icon: 'ship', root: 'expeditions' },
  { path: '/documents', label: 'Documents', icon: 'file', root: 'documents' },
  { path: '/couts', label: 'Coûts', icon: 'calc', root: 'couts' },
]

export function Shell({ section, children }: { section: string; children: ReactNode }) {
  const { org, session } = useStore()
  const theme = useTheme()
  return (
    <div className="shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/numera-mark.svg" alt="" width="32" height="32" />
          <span className="brand-mark">NUMERA</span>
          <span className="brand-org">{org.name}</span>
        </div>
        <div className="topbar-actions">
          <button
            className="topbar-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button
            className="topbar-btn"
            onClick={() => supabase.auth.signOut()}
            title={`Se déconnecter (${session.user.email})`}
          >
            <Icon name="logout" />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>
      <nav className="nav" aria-label="Navigation principale">
        {NAV.map((n) => (
          <a
            key={n.path}
            href={`#${n.path}`}
            className="nav-item"
            aria-current={section === n.root ? 'page' : undefined}
          >
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <main id="contenu" className="content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}

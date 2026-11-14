import type { Session } from '@supabase/supabase-js'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { Shell } from './components/Shell.tsx'
import { useRoute } from './lib/router.ts'
import { StoreProvider } from './lib/store.tsx'
import { explain, isConfigured, openedFromRecoveryLink, supabase } from './lib/supabase.ts'
import type { Invitation, Organization, Role } from './lib/types.ts'
import { Auth } from './screens/Auth.tsx'
import { NewPassword } from './screens/NewPassword.tsx'
import { Onboarding } from './screens/Onboarding.tsx'

// Un fichier par écran : le téléphone ne télécharge que ce qu'il affiche.
// Sur une connexion instable, un téléchargement d'écran raté est retenté avant d'abandonner.
function lazyScreen<P>(load: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await load()
      } catch (error) {
        if (attempt >= 2) throw error
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
      }
    }
  })
}

const Dashboard = lazyScreen(() => import('./screens/Dashboard.tsx'))
const Orders = lazyScreen(() => import('./screens/Orders.tsx'))
const Shipments = lazyScreen(() => import('./screens/Shipments.tsx'))
const Documents = lazyScreen(() => import('./screens/Documents.tsx'))
const Costs = lazyScreen(() => import('./screens/Costs.tsx'))
const Team = lazyScreen(() => import('./screens/Team.tsx'))
const Subscription = lazyScreen(() => import('./screens/Subscription.tsx'))
const Platform = lazyScreen(() => import('./screens/Platform.tsx'))

const Splash = ({ text = 'Chargement…' }: { text?: string }) => (
  <div className="splash" role="status">
    <span className="spinner" aria-hidden="true" />
    {text}
  </div>
)

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [org, setOrg] = useState<Organization | null | undefined>(undefined)
  const [role, setRole] = useState<Role>('member')
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(openedFromRecoveryLink)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const loadOrg = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase
      .from('organization_members')
      .select('role, organizations(id, name, country, currency)')
      // Un membre voit toutes les adhésions de son entreprise : on ne garde que la sienne.
      .eq('user_id', userId ?? '')
      .limit(1)
    if (e) return setError(explain(e))
    const found = (data[0]?.organizations as unknown as Organization | undefined) ?? null
    if (!found) {
      // Pas encore d'entreprise : un collègue l'a peut-être invité.
      const { data: pending, error: invError } = await supabase.rpc('my_invitations')
      if (invError) return setError(explain(invError))
      setInvitations(pending as Invitation[])
    } else setRole(data[0].role as Role)
    setOrg(found)
  }, [userId])

  useEffect(() => {
    setOrg(undefined)
    if (userId) void loadOrg()
  }, [userId, loadOrg])

  if (!isConfigured)
    return (
      <div className="splash">
        <p role="alert">
          Configuration manquante : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir le fichier
          .env.example).
        </p>
      </div>
    )
  if (session === undefined) return <Splash />
  if (!session) return <Auth />
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />
  if (error)
    return (
      <div className="splash">
        <p role="alert">{error}</p>
        <button className="btn" onClick={loadOrg}>
          Réessayer
        </button>
      </div>
    )
  if (org === undefined) return <Splash />
  if (!org) return <Onboarding email={session.user.email ?? ''} invitations={invitations} onDone={loadOrg} />

  return (
    <StoreProvider session={session} org={org} role={role}>
      <Router />
    </StoreProvider>
  )
}

function Router() {
  const route = useRoute()
  const [section = '', ...rest] = route.segments

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.path])

  let screen
  if (section === 'commandes') screen = <Orders rest={rest} />
  else if (section === 'expeditions') screen = <Shipments rest={rest} query={route.query} />
  else if (section === 'documents') screen = <Documents rest={rest} />
  else if (section === 'couts') screen = <Costs rest={rest} />
  else if (section === 'equipe') screen = <Team />
  else if (section === 'abonnement') screen = <Subscription />
  else if (section === 'plateforme') screen = <Platform />
  else screen = <Dashboard />

  return (
    <Shell
      section={
        ['commandes', 'expeditions', 'documents', 'couts'].includes(section)
          ? section
          : ['equipe', 'abonnement', 'plateforme'].includes(section)
            ? 'equipe'
            : ''
      }
    >
      <ErrorBoundary key={route.path}>
        <Suspense fallback={<Splash />}>{screen}</Suspense>
      </ErrorBoundary>
    </Shell>
  )
}

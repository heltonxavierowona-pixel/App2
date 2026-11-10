import type { Session } from '@supabase/supabase-js'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Shell } from './components/Shell.tsx'
import { useRoute } from './lib/router.ts'
import { StoreProvider } from './lib/store.tsx'
import { explain, isConfigured, supabase } from './lib/supabase.ts'
import type { Organization } from './lib/types.ts'
import { Auth } from './screens/Auth.tsx'
import { Onboarding } from './screens/Onboarding.tsx'

// Un fichier par écran : le téléphone ne télécharge que ce qu'il affiche.
const Dashboard = lazy(() => import('./screens/Dashboard.tsx'))
const Orders = lazy(() => import('./screens/Orders.tsx'))
const Shipments = lazy(() => import('./screens/Shipments.tsx'))
const Documents = lazy(() => import('./screens/Documents.tsx'))
const Costs = lazy(() => import('./screens/Costs.tsx'))

const Splash = ({ text = 'Chargement…' }: { text?: string }) => (
  <div className="splash" role="status">
    <span className="spinner" aria-hidden="true" />
    {text}
  </div>
)

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [org, setOrg] = useState<Organization | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const loadOrg = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase
      .from('organization_members')
      .select('organizations(id, name, country, currency)')
      .limit(1)
    if (e) return setError(explain(e))
    setOrg((data[0]?.organizations as unknown as Organization | undefined) ?? null)
  }, [])

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
  if (!org) return <Onboarding email={session.user.email ?? ''} onDone={loadOrg} />

  return (
    <StoreProvider session={session} org={org}>
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
  else screen = <Dashboard />

  return (
    <Shell section={['commandes', 'expeditions', 'documents', 'couts'].includes(section) ? section : ''}>
      <Suspense fallback={<Splash />}>{screen}</Suspense>
    </Shell>
  )
}

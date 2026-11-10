import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { EUR_PEG } from './constants.ts'
import { explain, supabase } from './supabase.ts'
import type { Order, Organization, Rates, Role, Shipment, Supplier } from './types.ts'

type Part = 'suppliers' | 'orders' | 'shipments' | 'rates'
const ALL: Part[] = ['suppliers', 'orders', 'shipments', 'rates']

interface Data {
  suppliers: Supplier[]
  orders: Order[]
  shipments: Shipment[]
  rates: Rates
}

interface Store extends Data {
  session: Session
  org: Organization
  /** Rôle de l'utilisateur dans l'entreprise : seul l'administrateur gère l'équipe. */
  role: Role
  /** Recharge les données indiquées (toutes par défaut) après une modification. */
  reload: (parts?: Part[]) => Promise<void>
  supplierOf: (order: Order | undefined) => Supplier | undefined
  orderOf: (shipment: Shipment) => Order | undefined
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(Ctx)
  if (!store) throw new Error('useStore hors de StoreProvider')
  return store
}

const EMPTY: Data = {
  suppliers: [],
  orders: [],
  shipments: [],
  rates: { EUR: EUR_PEG, USD: 600, CNY: 83 },
}

async function fetchPart(part: Part): Promise<Partial<Data>> {
  if (part === 'suppliers') {
    const { data, error } = await supabase.from('suppliers').select('*').order('name')
    if (error) throw error
    return { suppliers: data as Supplier[] }
  }
  if (part === 'orders') {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .order('order_date', { ascending: false })
      .order('position', { referencedTable: 'purchase_order_items' })
    if (error) throw error
    return { orders: data as Order[] }
  }
  if (part === 'shipments') {
    const { data, error } = await supabase
      .from('shipments')
      .select('*, items:shipment_items(id, purchase_order_item_id, quantity), documents(*), costs:shipment_costs(*)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return { shipments: data as Shipment[] }
  }
  const { data, error } = await supabase.from('exchange_rates').select('currency, rate')
  if (error) throw error
  const rates = { ...EMPTY.rates }
  for (const r of data as { currency: keyof Rates; rate: number }[]) rates[r.currency] = Number(r.rate)
  return { rates }
}

export function StoreProvider({
  session,
  org,
  role,
  children,
}: {
  session: Session
  org: Organization
  role: Role
  children: ReactNode
}) {
  const [data, setData] = useState<Data>(EMPTY)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const loaded = useRef(false)

  const reload = useCallback(async (parts: Part[] = ALL) => {
    const results = await Promise.all(parts.map(fetchPart))
    setData((prev) => Object.assign({}, prev, ...results))
  }, [])

  const boot = useCallback(() => {
    setState('loading')
    reload()
      .then(() => {
        loaded.current = true
        setState('ready')
      })
      .catch((e) => {
        setError(explain(e))
        setState('error')
      })
  }, [reload])

  useEffect(boot, [boot, org.id])

  const store = useMemo<Store>(
    () => ({
      ...data,
      session,
      org,
      role,
      reload,
      supplierOf: (order) => data.suppliers.find((s) => s.id === order?.supplier_id),
      orderOf: (shipment) => data.orders.find((o) => o.id === shipment.purchase_order_id),
    }),
    [data, session, org, role, reload],
  )

  if (state === 'loading' && !loaded.current)
    return (
      <div className="splash" role="status">
        <span className="spinner" aria-hidden="true" />
        Chargement de vos données…
      </div>
    )
  if (state === 'error')
    return (
      <div className="splash">
        <p role="alert">{error}</p>
        <button className="btn" onClick={boot}>
          Réessayer
        </button>
      </div>
    )
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

import type { ReactNode } from 'react'
import { lateDays } from '../lib/costs.ts'
import { shortDate, todayISO } from '../lib/format.ts'
import { useStore } from '../lib/store.tsx'
import type { Shipment } from '../lib/types.ts'
import { Icon, LateBadge, RouteLine, StatusBadge } from './ui.tsx'

/** Résumé des produits d'un lot : « Riz parfumé… » ou « Pneus moto + 2 autres ». */
export function useProductSummary() {
  const { orderOf } = useStore()
  return (s: Shipment) => {
    const order = orderOf(s)
    const names = s.items
      .map((si) => order?.items.find((it) => it.id === si.purchase_order_item_id)?.product_name)
      .filter(Boolean) as string[]
    if (names.length === 0) return 'Aucun produit'
    return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} autre${names.length > 2 ? 's' : ''}`
  }
}

/** Prochaine échéance utile à afficher pour une expédition. */
export function nextMilestone(s: Shipment): string {
  if (s.status === 'delivered') return `Livré le ${shortDate(s.actual_delivery)}`
  if (s.actual_arrival)
    return s.planned_delivery ? `Livraison prévue le ${shortDate(s.planned_delivery)}` : 'Livraison à planifier'
  if (s.status === 'ordered' && s.planned_departure) return `Départ prévu le ${shortDate(s.planned_departure)}`
  return s.planned_arrival ? `Arrivée prévue le ${shortDate(s.planned_arrival)}` : 'Arrivée à planifier'
}

export function ShipmentRow({ shipment: s, href, extra }: { shipment: Shipment; href: string; extra?: ReactNode }) {
  const { orderOf, supplierOf } = useStore()
  const summary = useProductSummary()
  const late = lateDays(s, todayISO())
  return (
    <a className="row" href={`#${href}`}>
      <div className="row-main">
        <div className="row-title">
          <strong>{s.reference}</strong>
          <StatusBadge status={s.status} />
          <LateBadge days={late} />
        </div>
        <p className="row-sub">
          {summary(s)} · {supplierOf(orderOf(s))?.name ?? 'Fournisseur inconnu'}
        </p>
        <RouteLine status={s.status} late={late > 0} />
        <p className="row-meta">{extra ?? nextMilestone(s)}</p>
      </div>
      <Icon name="chevron" size={18} />
    </a>
  )
}

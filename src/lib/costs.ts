import { COST_CATEGORIES, DOC_TYPES } from './constants.ts'
import { daysBetween, isLocal } from './format.ts'
import type { CostCategory, Currency, DocType, Order, OrderItem, Rates, Shipment } from './types.ts'

/** Taux à appliquer pour convertir un montant vers le FCFA. */
export const rateFor = (currency: Currency, rates: Rates) => (isLocal(currency) ? 1 : rates[currency])

export const orderTotal = (order: Order) =>
  order.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)

export const orderTotalFcfa = (order: Order) =>
  Math.round(orderTotal(order) * (isLocal(order.currency) ? 1 : order.exchange_rate))

export interface CostLine {
  item: OrderItem
  quantity: number
  purchase: number
  fees: number
  total: number
  unitCost: number
  revenue: number | null
  margin: number | null
}

export interface LotCosting {
  lines: CostLine[]
  purchase: number
  fees: Record<CostCategory, number>
  feesTotal: number
  total: number
  /** Chiffre d'affaires prévu, sur les seules lignes qui ont un prix de vente. */
  revenue: number
  margin: number
  marginRate: number | null
  /** Vrai si au moins une ligne n'a pas de prix de vente : la marge est alors partielle. */
  missingSalePrice: boolean
}

/**
 * Coût de revient d'un lot : achat + frais d'approche, les frais étant répartis
 * entre produits au prorata de leur valeur d'achat (à défaut, de leur quantité).
 * Tous les montants sont en FCFA.
 */
export function lotCosting(
  shipment: Pick<Shipment, 'items'>,
  order: Order,
  feesFcfa: Partial<Record<CostCategory, number>>,
): LotCosting {
  const rate = isLocal(order.currency) ? 1 : order.exchange_rate
  const fees = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, feesFcfa[c] ?? 0]),
  ) as Record<CostCategory, number>
  const feesTotal = COST_CATEGORIES.reduce((s, c) => s + fees[c], 0)

  const base = shipment.items.flatMap((si) => {
    const item = order.items.find((it) => it.id === si.purchase_order_item_id)
    return item ? [{ item, quantity: si.quantity, purchase: si.quantity * item.unit_price * rate }] : []
  })
  const purchase = base.reduce((s, l) => s + l.purchase, 0)
  const totalQty = base.reduce((s, l) => s + l.quantity, 0)

  const lines: CostLine[] = base.map((l) => {
    const share = purchase > 0 ? l.purchase / purchase : totalQty > 0 ? l.quantity / totalQty : 0
    const lineFees = feesTotal * share
    const total = l.purchase + lineFees
    const sale = l.item.sale_unit_price_fcfa
    const revenue = sale == null ? null : sale * l.quantity
    return {
      ...l,
      fees: lineFees,
      total,
      unitCost: l.quantity > 0 ? total / l.quantity : 0,
      revenue,
      margin: revenue == null ? null : revenue - total,
    }
  })

  const priced = lines.filter((l) => l.revenue != null)
  const revenue = priced.reduce((s, l) => s + (l.revenue ?? 0), 0)
  const margin = priced.reduce((s, l) => s + (l.margin ?? 0), 0)
  return {
    lines,
    purchase,
    fees,
    feesTotal,
    total: purchase + feesTotal,
    revenue,
    margin,
    marginRate: revenue > 0 ? margin / revenue : null,
    missingSalePrice: priced.length < lines.length,
  }
}

export const savedFees = (shipment: Shipment) =>
  Object.fromEntries(shipment.costs.map((c) => [c.category, Number(c.amount_fcfa)])) as Partial<
    Record<CostCategory, number>
  >

/**
 * Jours de retard sur la prochaine échéance : arrivée au port tant que le
 * navire n'est pas arrivé, puis livraison. 0 si l'expédition est dans les temps.
 */
export function lateDays(s: Shipment, today: string): number {
  if (s.status === 'delivered' || s.actual_delivery) return 0
  const due = s.actual_arrival ? s.planned_delivery : s.planned_arrival
  return due ? Math.max(0, daysBetween(due, today)) : 0
}

export const missingDocs = (s: Pick<Shipment, 'documents'>): DocType[] =>
  DOC_TYPES.filter((t) => !s.documents.some((d) => d.doc_type === t))

/** Marge cumulée des lots livrés pendant le mois de `today`. */
export function monthMargin(shipments: Shipment[], orders: Order[], today: string) {
  const month = today.slice(0, 7)
  let margin = 0
  let lots = 0
  for (const s of shipments) {
    if (s.status !== 'delivered' || s.actual_delivery?.slice(0, 7) !== month) continue
    const order = orders.find((o) => o.id === s.purchase_order_id)
    if (!order) continue
    margin += lotCosting(s, order, savedFees(s)).margin
    lots += 1
  }
  return { margin, lots }
}

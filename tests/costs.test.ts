import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lateDays, lotCosting, missingDocs, monthMargin, orderTotalFcfa } from '../src/lib/costs.ts'
import { fcfa, parseNumber } from '../src/lib/format.ts'
import type { Order, Shipment } from '../src/lib/types.ts'

const order: Order = {
  id: 'o1',
  supplier_id: 's1',
  reference: 'CMD-1',
  order_date: '2026-10-01',
  currency: 'USD',
  exchange_rate: 600,
  incoterm: 'FOB',
  notes: null,
  items: [
    { id: 'a', position: 0, product_name: 'A', quantity: 100, unit: 'sac', unit_price: 10, sale_unit_price_fcfa: 9000 },
    { id: 'b', position: 1, product_name: 'B', quantity: 50, unit: 'sac', unit_price: 60, sale_unit_price_fcfa: null },
  ],
}

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'sh1',
  purchase_order_id: 'o1',
  reference: 'EXP-1',
  status: 'at_sea',
  container_number: null,
  bl_number: null,
  carrier: null,
  origin_port: null,
  destination_port: null,
  planned_departure: null,
  actual_departure: null,
  planned_arrival: '2026-11-06',
  actual_arrival: null,
  planned_clearance: null,
  actual_clearance: null,
  planned_delivery: '2026-11-20',
  actual_delivery: null,
  notes: null,
  items: [
    { id: 'x', purchase_order_item_id: 'a', quantity: 100 },
    { id: 'y', purchase_order_item_id: 'b', quantity: 50 },
  ],
  documents: [],
  costs: [],
  ...over,
})

test('le total de commande est converti au taux figé', () => {
  assert.equal(orderTotalFcfa(order), (100 * 10 + 50 * 60) * 600)
  assert.equal(orderTotalFcfa({ ...order, currency: 'XOF', exchange_rate: 600 }), 4000)
})

test('les frais sont répartis au prorata de la valeur d’achat', () => {
  const c = lotCosting(shipment(), order, { freight: 300_000, customs: 100_000 })
  assert.equal(c.purchase, 2_400_000)
  assert.equal(c.feesTotal, 400_000)
  assert.equal(c.total, 2_800_000)
  // A = 600 000 d'achat sur 2 400 000, soit un quart des frais.
  assert.equal(c.lines[0].fees, 100_000)
  assert.equal(c.lines[0].unitCost, 7_000)
  assert.equal(c.lines[0].margin, 200_000)
  assert.equal(c.lines[1].unitCost, (1_800_000 + 300_000) / 50)
  // B n'a pas de prix de vente : la marge ne porte que sur A.
  assert.equal(c.missingSalePrice, true)
  assert.equal(c.margin, 200_000)
  assert.equal(c.marginRate, 200_000 / 900_000)
})

test('une expédition partielle ne compte que les quantités expédiées', () => {
  const c = lotCosting({ items: [{ id: 'x', purchase_order_item_id: 'a', quantity: 40 }] }, order, {})
  assert.equal(c.purchase, 240_000)
  assert.equal(c.lines.length, 1)
  assert.equal(c.lines[0].unitCost, 6_000)
})

test('le retard suit la prochaine échéance', () => {
  assert.equal(lateDays(shipment(), '2026-11-10'), 4)
  assert.equal(lateDays(shipment(), '2026-11-06'), 0)
  // Arrivé : c'est la date de livraison qui compte.
  assert.equal(lateDays(shipment({ status: 'at_port', actual_arrival: '2026-11-09' }), '2026-11-10'), 0)
  assert.equal(lateDays(shipment({ status: 'cleared', actual_arrival: '2026-11-09' }), '2026-11-23'), 3)
  assert.equal(lateDays(shipment({ status: 'delivered', actual_delivery: '2026-11-25' }), '2026-11-30'), 0)
})

test('les pièces absentes sont manquantes', () => {
  const docs = [{ id: 'd', doc_type: 'invoice', status: 'uploaded', file_path: null, file_name: null, uploaded_at: '' }] as Shipment['documents']
  assert.deepEqual(missingDocs({ documents: docs }), [
    'packing_list',
    'bill_of_lading',
    'certificate_of_origin',
    'customs_declaration',
  ])
})

test('la marge du mois ne retient que les lots livrés dans le mois', () => {
  const costs = [{ id: 'c', category: 'freight', amount: 500, currency: 'USD', exchange_rate: 600, amount_fcfa: 300_000 }] as Shipment['costs']
  const delivered = shipment({ status: 'delivered', actual_delivery: '2026-11-03', costs })
  const lastMonth = shipment({ id: 'sh2', status: 'delivered', actual_delivery: '2026-10-28' })
  const r = monthMargin([delivered, lastMonth, shipment({ id: 'sh3' })], [order], '2026-11-10')
  assert.equal(r.lots, 1)
  assert.equal(r.margin, 900_000 - (600_000 + 300_000 * 0.25))
})

test('formatage et saisie des montants', () => {
  assert.equal(fcfa(1234567.4).replace(/\s/g, ' '), '1 234 567 FCFA')
  assert.equal(parseNumber('1 250,5'), 1250.5)
  assert.equal(parseNumber(''), null)
  assert.equal(parseNumber('abc'), null)
})

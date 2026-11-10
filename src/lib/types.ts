export type LocalCurrency = 'XOF' | 'XAF'
export type Currency = LocalCurrency | 'EUR' | 'USD' | 'CNY'
export type Status = 'ordered' | 'shipped' | 'at_sea' | 'at_port' | 'cleared' | 'delivered'
export type DocType =
  | 'invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'certificate_of_origin'
  | 'customs_declaration'
export type CostCategory = 'freight' | 'insurance' | 'customs' | 'transit' | 'local_transport'

export interface Organization {
  id: string
  name: string
  country: string
  currency: LocalCurrency
}

export type Role = 'admin' | 'member'

export interface Invitation {
  id: string
  organization_name: string
  role: Role
}

export interface Supplier {
  id: string
  name: string
  country: string | null
  city: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  default_currency: Currency
}

export interface OrderItem {
  id: string
  position: number
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  sale_unit_price_fcfa: number | null
}

export interface Order {
  id: string
  supplier_id: string
  reference: string
  order_date: string
  currency: Currency
  exchange_rate: number
  incoterm: string
  notes: string | null
  items: OrderItem[]
}

export interface ShipmentItem {
  id: string
  purchase_order_item_id: string
  quantity: number
}

export interface Doc {
  id: string
  doc_type: DocType
  status: 'uploaded' | 'validated'
  file_path: string | null
  file_name: string | null
  uploaded_at: string
}

export interface Cost {
  id: string
  category: CostCategory
  amount: number
  currency: Currency
  exchange_rate: number
  amount_fcfa: number
}

export interface Shipment {
  id: string
  purchase_order_id: string
  reference: string
  status: Status
  container_number: string | null
  bl_number: string | null
  carrier: string | null
  origin_port: string | null
  destination_port: string | null
  planned_departure: string | null
  actual_departure: string | null
  planned_arrival: string | null
  actual_arrival: string | null
  planned_clearance: string | null
  actual_clearance: string | null
  planned_delivery: string | null
  actual_delivery: string | null
  notes: string | null
  items: ShipmentItem[]
  documents: Doc[]
  costs: Cost[]
}

/** Taux de conversion vers le FCFA, par devise étrangère. */
export type Rates = Record<'EUR' | 'USD' | 'CNY', number>

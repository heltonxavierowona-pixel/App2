import type { CostCategory, Currency, DocType, LocalCurrency, Status } from './types.ts'

export const STATUSES: Status[] = ['ordered', 'shipped', 'at_sea', 'at_port', 'cleared', 'delivered']

export const STATUS_LABEL: Record<Status, string> = {
  ordered: 'Commandé',
  shipped: 'Embarqué',
  at_sea: 'En mer',
  at_port: 'Au port',
  cleared: 'Dédouané',
  delivered: 'Livré',
}

export const DOC_TYPES: DocType[] = [
  'invoice',
  'packing_list',
  'bill_of_lading',
  'certificate_of_origin',
  'customs_declaration',
]

export const DOC_LABEL: Record<DocType, string> = {
  invoice: 'Facture commerciale',
  packing_list: 'Liste de colisage',
  bill_of_lading: 'Connaissement',
  certificate_of_origin: 'Certificat d’origine',
  customs_declaration: 'Déclaration en douane',
}

export const COST_CATEGORIES: CostCategory[] = [
  'freight',
  'insurance',
  'customs',
  'transit',
  'local_transport',
]

export const COST_LABEL: Record<CostCategory, string> = {
  freight: 'Fret',
  insurance: 'Assurance',
  customs: 'Douane',
  transit: 'Transit',
  local_transport: 'Transport local',
}

export const FOREIGN_CURRENCIES = ['EUR', 'USD', 'CNY'] as const

export const CURRENCY_LABEL: Record<Currency, string> = {
  XOF: 'FCFA',
  XAF: 'FCFA',
  EUR: 'EUR',
  USD: 'USD',
  CNY: 'CNY',
}

/** Parité fixe de l'euro avec le franc CFA (XOF et XAF). */
export const EUR_PEG = 655.957

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']

export const UNITS = ['unité', 'pièce', 'carton', 'sac', 'kg', 'tonne', 'm²', 'litre', 'bidon', 'fût', 'jeu']

/** Pays de la zone franc et leur monnaie. */
export const COUNTRIES: { name: string; currency: LocalCurrency }[] = [
  { name: 'Bénin', currency: 'XOF' },
  { name: 'Burkina Faso', currency: 'XOF' },
  { name: 'Cameroun', currency: 'XAF' },
  { name: 'Centrafrique', currency: 'XAF' },
  { name: 'Congo', currency: 'XAF' },
  { name: 'Côte d’Ivoire', currency: 'XOF' },
  { name: 'Gabon', currency: 'XAF' },
  { name: 'Guinée-Bissau', currency: 'XOF' },
  { name: 'Guinée équatoriale', currency: 'XAF' },
  { name: 'Mali', currency: 'XOF' },
  { name: 'Niger', currency: 'XOF' },
  { name: 'Sénégal', currency: 'XOF' },
  { name: 'Tchad', currency: 'XAF' },
  { name: 'Togo', currency: 'XOF' },
]

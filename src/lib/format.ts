import type { Currency } from './types.ts'

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const dec = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })
const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const full = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** L'espace fine insécable de fr-FR est presque invisible à l'écran : on la remplace par une insécable normale. */
const wide = (s: string) => s.replace(/\u202f/g, '\u00a0')

export const isLocal = (c: Currency) => c === 'XOF' || c === 'XAF'

/** Montant en francs CFA, toujours sans décimales. */
export const fcfa = (n: number) => `${wide(int.format(Math.round(n)))}\u00a0FCFA`

export const money = (n: number, c: Currency) => (isLocal(c) ? fcfa(n) : `${wide(dec.format(n))}\u00a0${c}`)

export const quantity = (n: number) => wide(qty.format(n))

export const percent = (n: number) => wide(pct.format(n))

/** Date ISO du jour, dans le fuseau de l'utilisateur. */
export function todayISO(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)

export const shortDate = (iso: string | null) => (iso ? dayMonth.format(parse(iso)) : '—')
export const fullDate = (iso: string | null) => (iso ? full.format(parse(iso)) : '—')

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export const daysBetween = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000)

/** Lit un nombre saisi à la française (« 1 250,5 »). */
export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

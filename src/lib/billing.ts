import { daysBetween, fullDate, todayISO } from './format.ts'
import type { Billing, Plan } from './types.ts'

export const planOf = (billing: Billing, id = billing.plan_id): Plan | undefined =>
  billing.plans.find((p) => p.id === id)

/** Jours restants avant la fin de l'essai ou de la période payée (0 si dépassé ou sans objet). */
export function daysLeft(billing: Billing): number {
  const end = billing.state === 'trial' ? billing.trial_ends_at : billing.current_period_end
  return end ? Math.max(0, daysBetween(todayISO(), end.slice(0, 10))) : 0
}

export function stateSentence(billing: Billing): string {
  const name = planOf(billing)?.name ?? ''
  if (billing.state === 'trial')
    return `Essai gratuit de l’offre ${name} jusqu’au ${fullDate(billing.trial_ends_at)}.`
  if (billing.state === 'active') return `Offre ${name} active jusqu’au ${fullDate(billing.current_period_end)}.`
  return billing.had_paid_plan
    ? 'Votre abonnement est terminé : vous êtes sur l’offre gratuite Découverte.'
    : 'Votre essai est terminé : vous êtes sur l’offre gratuite Découverte.'
}

/** Vrai si l'usage actuel dépasse une limite de l'offre en vigueur. */
export function overLimit(billing: Billing): boolean {
  const limits = planOf(billing)?.limits ?? {}
  return (
    (limits.active_shipments != null && billing.usage.active_shipments > limits.active_shipments) ||
    (limits.members != null && billing.usage.members > limits.members)
  )
}

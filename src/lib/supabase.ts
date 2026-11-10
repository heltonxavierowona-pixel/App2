import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

/** Vrai si la page a été ouverte depuis un lien « mot de passe oublié ». */
export const openedFromRecoveryLink = /[#&]type=recovery\b/.test(window.location.hash)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Traduit les erreurs techniques les plus courantes en message utile. */
export function explain(error: { message: string; code?: string } | Error | unknown): string {
  const e = error as { message?: string; code?: string }
  const msg = e?.message ?? ''
  if (/failed to fetch|networkerror|load failed/i.test(msg))
    return 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
  if (e?.code === '23505')
    return /entreprise/.test(msg) ? msg : 'Cette référence existe déjà. Choisissez-en une autre.'
  if (e?.code === '42501' && /administrateur/.test(msg)) return msg
  if (e?.code === '23503')
    return 'Cet élément est utilisé ailleurs (une expédition, par exemple) et ne peut pas être supprimé.'
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.'
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet e-mail. Connectez-vous.'
  if (/email not confirmed/i.test(msg))
    return 'Votre e-mail n’est pas encore confirmé. Ouvrez le lien reçu par e-mail.'
  if (/password should be at least/i.test(msg)) return 'Le mot de passe doit compter au moins 6 caractères.'
  if (/different from the old password/i.test(msg))
    return 'Choisissez un mot de passe différent de l’ancien.'
  if (/expired|invalid.*(token|link)/i.test(msg)) return 'Ce lien a expiré. Demandez-en un nouveau.'
  if (/error sending .*e-?mail/i.test(msg))
    return 'L’e-mail n’a pas pu être envoyé. Réessayez dans quelques minutes.'
  if (e?.code === 'P0002') return msg
  if (/rate limit/i.test(msg)) return 'Trop de tentatives. Patientez quelques minutes puis réessayez.'
  return msg || 'Une erreur est survenue. Réessayez.'
}

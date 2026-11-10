import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Traduit les erreurs techniques les plus courantes en message utile. */
export function explain(error: { message: string; code?: string } | Error | unknown): string {
  const e = error as { message?: string; code?: string }
  const msg = e?.message ?? ''
  if (/failed to fetch|networkerror|load failed/i.test(msg))
    return 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
  if (e?.code === '23505') return 'Cette référence existe déjà. Choisissez-en une autre.'
  if (e?.code === '23503')
    return 'Cet élément est utilisé ailleurs (une expédition, par exemple) et ne peut pas être supprimé.'
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.'
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet e-mail. Connectez-vous.'
  if (/email not confirmed/i.test(msg))
    return 'Votre e-mail n’est pas encore confirmé. Ouvrez le lien reçu par e-mail.'
  if (/password should be at least/i.test(msg)) return 'Le mot de passe doit compter au moins 6 caractères.'
  if (/rate limit/i.test(msg)) return 'Trop de tentatives. Patientez quelques minutes puis réessayez.'
  return msg || 'Une erreur est survenue. Réessayez.'
}

// Connexion au service en ligne (comptes, synchronisation, assistant).
// Ces deux valeurs sont publiques par nature : la sécurité repose sur les règles d'accès de la base.
// Laissez-les vides pour une utilisation sur un seul appareil, sans compte en ligne.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? '';

export const APP_NAME = 'NUMERA COMMERCIAL AI';
export const BRAND_SITE = 'https://numera-topaz.vercel.app';

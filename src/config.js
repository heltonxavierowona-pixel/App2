// Connexion au service en ligne (comptes, synchronisation, assistant).
// Ces deux valeurs sont publiques par nature : la sécurité repose sur les règles d'accès de la base.
// Les variables VITE_SUPABASE_URL / VITE_SUPABASE_KEY permettent de pointer vers un autre projet ;
// une valeur vide désactive le mode en ligne (utilisation sur un seul appareil).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://wocypkinmzjkyvxnnwyc.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_-v9Nfbu21XhFx2YK7ZItFA_RAr7zpnP';

export const APP_NAME = 'NUMERA COMMERCIAL AI';
export const BRAND_SITE = 'https://numera-topaz.vercel.app';

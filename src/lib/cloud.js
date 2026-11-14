// Service en ligne (Supabase) : comptes, boutiques, équipe, journal d'opérations, assistant.
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

let clientPromise = null;
export function client() {
  if (!clientPromise)
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY));
  return clientPromise;
}

const MESSAGES = [
  [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/email not confirmed/i, "Confirmez d'abord votre adresse : ouvrez le lien reçu par e-mail."],
  [/already registered|already been registered/i, 'Un compte existe déjà avec cette adresse e-mail.'],
  [/password should be at least/i, 'Le mot de passe doit contenir au moins 6 caractères.'],
  [/rate limit|too many/i, 'Trop de tentatives. Réessayez dans quelques minutes.'],
  [/failed to fetch|networkerror|load failed/i, 'Pas de connexion internet.'],
];
export const isOffline = (e) => /failed to fetch|networkerror|load failed/i.test(e?.message ?? '');
const translate = (e) => {
  const text = e?.message ?? String(e);
  const hit = MESSAGES.find(([re]) => re.test(text));
  const err = new Error(hit ? hit[1] : text);
  err.code = e?.code;
  err.offline = isOffline(e);
  return err;
};
const check = ({ data, error }) => { if (error) throw translate(error); return data; };
const guard = async (fn) => { try { return await fn(); } catch (e) { throw e.offline === undefined ? translate(e) : e; } };

export const getUser = () => guard(async () => {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
});

// Ouverture de compte. Le nom de la boutique est enregistré avec le compte :
// la boutique est créée à la première connexion (après confirmation de l'e-mail si elle est exigée).
export const signUp = ({ email, password, name, shop }) => guard(async () => {
  const sb = await client();
  const data = check(await sb.auth.signUp({
    email, password,
    options: { data: { name, pending_shop: shop ?? null }, emailRedirectTo: window.location.origin + window.location.pathname },
  }));
  return { user: data.session ? data.user : null, needsConfirmation: !data.session };
});

export const signIn = ({ email, password }) => guard(async () => {
  const sb = await client();
  return check(await sb.auth.signInWithPassword({ email, password })).user;
});

export const signOut = () => guard(async () => { await (await client()).auth.signOut(); });

export const listShops = (email) => guard(async () => {
  const sb = await client();
  const rows = check(await sb.from('commerce_members')
    .select('role, shop:commerce_shops(id, name, currency)').eq('email', email.toLowerCase()));
  return rows.filter((r) => r.shop).map((r) => ({ ...r.shop, role: r.role }));
});

export const createShop = (name, currency) => guard(async () => {
  const sb = await client();
  const shop = check(await sb.rpc('commerce_create_shop', { shop_name: name, shop_currency: currency }));
  return { id: shop.id, name: shop.name, currency: shop.currency, role: 'owner' };
});

export const clearPendingShop = () => guard(async () => {
  const sb = await client();
  await sb.auth.updateUser({ data: { pending_shop: null } });
});

export const pushOp = (shopId, op) => guard(async () => {
  const sb = await client();
  const { error } = await sb.from('commerce_ops').insert({
    id: op.id, shop_id: shopId, user_name: op.user, action: op.action, payload: op.payload, ts: op.ts,
  });
  if (error && error.code !== '23505') throw translate(error); // 23505 : déjà envoyée
});

export const pullOps = (shopId, afterSeq) => guard(async () => {
  const sb = await client();
  const rows = check(await sb.from('commerce_ops')
    .select('seq, id, user_name, action, payload, ts')
    .eq('shop_id', shopId).gt('seq', afterSeq).order('seq').limit(500));
  return rows.map((r) => ({ seq: r.seq, id: r.id, user: r.user_name, action: r.action, payload: r.payload, ts: r.ts }));
});

export async function subscribeOps(shopId, onChange) {
  const sb = await client();
  const channel = sb.channel(`ops-${shopId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'commerce_ops', filter: `shop_id=eq.${shopId}` }, onChange)
    .subscribe();
  return () => { sb.removeChannel(channel); };
}

export const listMembers = (shopId) => guard(async () => {
  const sb = await client();
  return check(await sb.from('commerce_members').select('email, role, created_at').eq('shop_id', shopId).order('created_at'));
});

export const inviteSeller = (shopId, email) => guard(async () => {
  const sb = await client();
  check(await sb.from('commerce_members').insert({ shop_id: shopId, email: email.trim().toLowerCase(), role: 'seller' }));
});

export const removeMember = (shopId, email) => guard(async () => {
  const sb = await client();
  check(await sb.from('commerce_members').delete().eq('shop_id', shopId).eq('email', email));
});

export const askAssistant = (shopId, question, context) => guard(async () => {
  const sb = await client();
  const { data, error } = await sb.functions.invoke('commerce-assistant', { body: { shopId, question, context } });
  if (error) {
    let detail = null;
    try { detail = await error.context?.json?.(); } catch { /* pas de corps JSON */ }
    const err = translate(new Error(detail?.error ?? error.message));
    err.code = detail?.code;
    throw err;
  }
  return data.answer;
});

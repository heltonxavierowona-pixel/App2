import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { emptyState, normalize, applyOp, actionName, canDo } from './lib/logic.js';
import { kvGet, kvSet, kvDel } from './lib/db.js';
import * as cloud from './lib/cloud.js';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const newId = () => globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

export function StoreProvider({ children }) {
  const [boot, setBoot] = useState('loading'); // loading | auth | noshop | ready
  const [session, setSession] = useState(null); // { mode, userName, email, shops, currentShopId }
  const [data, setData] = useState(null);       // { shopId, confirmed, lastSeq, pending }
  const [syncStatus, setSyncStatus] = useState('local'); // local | syncing | synced | offline | error
  const [toast, setToast] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const dataRef = useRef(null);
  const sessionRef = useRef(null);
  const syncing = useRef(false);

  const notify = useCallback((text, kind = 'ok') => setToast({ text, kind, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const commit = useCallback((next) => {
    dataRef.current = next;
    setData(next);
    kvSet(`shop:${next.shopId}`, next);
  }, []);

  const saveSession = useCallback((next) => {
    sessionRef.current = next;
    setSession(next);
    return next ? kvSet('session', next) : kvDel('session');
  }, []);

  const loadShop = useCallback(async (shop) => {
    const saved = await kvGet(`shop:${shop.id}`);
    const next = saved
      ? { ...saved, confirmed: normalize(saved.confirmed, shop.name, shop.currency) }
      : { shopId: shop.id, confirmed: emptyState(shop.name, shop.currency), lastSeq: 0, pending: [] };
    dataRef.current = next;
    setData(next);
  }, []);

  // ---------- Synchronisation (mode en ligne) ----------

  const sync = useCallback(async () => {
    const s = sessionRef.current;
    if (syncing.current || s?.mode !== 'cloud' || !dataRef.current) return;
    syncing.current = true;
    setSyncStatus('syncing');
    const shopId = dataRef.current.shopId;
    const same = () => dataRef.current?.shopId === shopId;
    let ok = false;
    try {
      for (const op of [...dataRef.current.pending]) {
        try { await cloud.pushOp(shopId, op); } catch (e) {
          if (e.offline) throw e;
          if (same()) commit({ ...dataRef.current, pending: dataRef.current.pending.filter((p) => p.id !== op.id) });
          notify(`Une opération a été refusée par le serveur : ${e.message}`, 'error');
        }
      }
      while (same()) {
        const ops = await cloud.pullOps(shopId, dataRef.current.lastSeq);
        if (!ops.length || !same()) break;
        let confirmed = dataRef.current.confirmed;
        const seen = new Set();
        for (const op of ops) {
          try { confirmed = applyOp(confirmed, op, { lenient: true }); } catch { /* opération ignorée */ }
          seen.add(op.id);
        }
        const cur = dataRef.current;
        commit({ ...cur, confirmed, lastSeq: ops.at(-1).seq, pending: cur.pending.filter((p) => !seen.has(p.id)) });
        if (ops.length < 500) break;
      }
      ok = true;
      setSyncStatus('synced');
    } catch (e) {
      setSyncStatus(e.offline ? 'offline' : 'error');
    } finally {
      syncing.current = false;
      if (ok && same() && dataRef.current.pending.length) setTimeout(sync, 0);
    }
  }, [commit, notify]);

  const shopId = data?.shopId;
  useEffect(() => {
    if (boot !== 'ready' || session?.mode !== 'cloud' || !shopId) { setSyncStatus('local'); return undefined; }
    let stop = () => {};
    let cancelled = false;
    sync();
    cloud.subscribeOps(shopId, () => sync()).then((off) => { if (cancelled) off(); else stop = off; }).catch(() => {});
    const timer = setInterval(sync, 30000);
    window.addEventListener('online', sync);
    return () => { cancelled = true; stop(); clearInterval(timer); window.removeEventListener('online', sync); };
  }, [boot, session?.mode, shopId, sync]);

  // ---------- Ouverture de session ----------

  const enterShops = useCallback(async (base, shops, preferredId) => {
    const current = shops.find((x) => x.id === preferredId) ?? shops[0];
    await saveSession({ ...base, shops, currentShopId: current?.id ?? null });
    if (!current) { setBoot('noshop'); return; }
    await loadShop(current);
    setBoot('ready');
  }, [loadShop, saveSession]);

  const enterCloud = useCallback(async (user, preferredId) => {
    const email = user.email.toLowerCase();
    const base = { mode: 'cloud', email, userName: user.user_metadata?.name || email.split('@')[0] };
    let shops = await cloud.listShops(email);
    const pending = user.user_metadata?.pending_shop;
    if (!shops.length && pending?.name) {
      shops = [await cloud.createShop(pending.name, pending.currency || 'FCFA')];
      cloud.clearPendingShop().catch(() => {});
    }
    await enterShops(base, shops, preferredId);
  }, [enterShops]);

  useEffect(() => {
    (async () => {
      const saved = await kvGet('session');
      if (!saved) { setBoot('auth'); return; }
      if (saved.mode === 'cloud') {
        const user = cloud.cloudEnabled ? await cloud.getUser().catch(() => null) : null;
        if (!user) { setBoot('auth'); return; }
        try { await enterCloud(user, saved.currentShopId); }
        catch { await enterShops(saved, saved.shops, saved.currentShopId); } // hors connexion : boutiques en cache
        return;
      }
      await enterShops(saved, saved.shops, saved.currentShopId);
    })();
  }, [enterCloud, enterShops]);

  const auth = useMemo(() => ({
    openLocal: ({ name, shopName, currency }) =>
      enterShops({ mode: 'local', userName: name.trim(), email: null },
        [{ id: newId(), name: shopName.trim(), currency: currency.trim() || 'FCFA', role: 'owner' }]),
    signUp: async ({ name, email, password, shopName, currency }) => {
      const shop = shopName?.trim() ? { name: shopName.trim(), currency: currency?.trim() || 'FCFA' } : null;
      const { user, needsConfirmation } = await cloud.signUp({ email: email.trim(), password, name: name.trim(), shop });
      if (user) await enterCloud(user);
      return { needsConfirmation };
    },
    signIn: async ({ email, password }) => enterCloud(await cloud.signIn({ email: email.trim(), password })),
    signOut: async () => {
      const s = sessionRef.current;
      if (s?.mode === 'cloud') {
        await cloud.signOut().catch(() => {});
        for (const shop of s.shops) await kvDel(`shop:${shop.id}`);
      }
      await saveSession(null);
      dataRef.current = null;
      setData(null);
      setBoot('auth');
    },
    createShop: async ({ name, currency }) => {
      const s = sessionRef.current;
      const shop = s.mode === 'cloud'
        ? await cloud.createShop(name.trim(), currency.trim() || 'FCFA')
        : { id: newId(), name: name.trim(), currency: currency.trim() || 'FCFA', role: 'owner' };
      await enterShops(s, [...s.shops, shop], shop.id);
    },
    switchShop: async (id) => {
      const s = sessionRef.current;
      if (id !== s.currentShopId) await enterShops(s, s.shops, id);
    },
  }), [enterCloud, enterShops, saveSession]);

  // ---------- État affiché et actions ----------

  const shop = session?.shops?.find((x) => x.id === session.currentShopId) ?? null;
  const role = shop?.role ?? 'owner';

  const state = useMemo(() => {
    if (!data) return emptyState();
    let s = data.confirmed;
    for (const op of data.pending) {
      try { s = applyOp(s, op, { lenient: true }); } catch { /* opération en attente devenue invalide */ }
    }
    return shop && s.settings.shopName !== shop.name ? { ...s, settings: { ...s.settings, shopName: shop.name } } : s;
  }, [data, shop]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Applique une action ; renvoie le nouvel état si elle a réussi, sinon null (et affiche l'erreur).
  const run = useCallback((action, payload, okMessage) => {
    const s = sessionRef.current;
    const name = actionName(action);
    const current = s.shops.find((x) => x.id === s.currentShopId);
    if (!canDo(current.role, name)) { notify('Cette action est réservée au patron.', 'error'); return null; }
    const op = {
      id: newId(), ts: new Date().toISOString(), user: s.userName, action: name,
      payload: JSON.parse(JSON.stringify(payload ?? null)),
    };
    let next;
    try { next = applyOp(stateRef.current, op); } catch (e) { notify(e.message, 'error'); return null; }
    stateRef.current = next;
    const d = dataRef.current;
    if (s.mode === 'cloud') { commit({ ...d, pending: [...d.pending, op] }); setTimeout(sync, 0); }
    else commit({ ...d, confirmed: next });
    if (okMessage) notify(okMessage);
    return next;
  }, [commit, notify, sync]);

  const fmt = useMemo(() => {
    const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
    return (n) => `${nf.format(Math.round(n || 0))} ${state.settings.currency}`;
  }, [state.settings.currency]);

  // États de toutes les boutiques dont l'utilisateur est le patron (pour la vue d'ensemble).
  // Les boutiques non ouvertes sont lues dans le cache de l'appareil, puis mises à jour en ligne.
  const loadShopStates = useCallback(async () => {
    const s = sessionRef.current;
    const out = [];
    for (const item of s.shops.filter((x) => x.role === 'owner')) {
      if (item.id === s.currentShopId) { out.push({ ...item, state: stateRef.current, stale: false }); continue; }
      const saved = await kvGet(`shop:${item.id}`);
      const d = saved
        ? { ...saved, confirmed: normalize(saved.confirmed, item.name, item.currency) }
        : { shopId: item.id, confirmed: emptyState(item.name, item.currency), lastSeq: 0, pending: [] };
      let stale = false;
      if (s.mode === 'cloud') {
        try {
          for (;;) {
            const ops = await cloud.pullOps(item.id, d.lastSeq);
            if (!ops.length) break;
            const seen = new Set();
            for (const op of ops) {
              try { d.confirmed = applyOp(d.confirmed, op, { lenient: true }); } catch { /* opération ignorée */ }
              seen.add(op.id);
            }
            d.lastSeq = ops.at(-1).seq;
            d.pending = d.pending.filter((p) => !seen.has(p.id));
            if (ops.length < 500) break;
          }
          await kvSet(`shop:${item.id}`, d);
        } catch { stale = true; }
      }
      let state = d.confirmed;
      for (const op of d.pending) {
        try { state = applyOp(state, op, { lenient: true }); } catch { /* opération en attente invalide */ }
      }
      out.push({ ...item, state, stale });
    }
    return out;
  }, []);

  // Impression (facture, rapport) : le document est rendu hors de l'application puis imprimé.
  const print = useCallback((element) => setPrintDoc(element), []);
  useEffect(() => {
    if (!printDoc) return undefined;
    const done = () => setPrintDoc(null);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 80);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printDoc]);

  const value = useMemo(() => ({
    boot, session, shop, role, isOwner: role === 'owner', canManage: role !== 'seller', state, run, notify, fmt, auth, print,
    loadShopStates,
    syncStatus, pendingCount: data?.pending.length ?? 0, sync, cloudEnabled: cloud.cloudEnabled,
  }), [boot, session, shop, role, state, run, notify, fmt, auth, print, loadShopStates, syncStatus, data, sync]);

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toast && <div className={`toast ${toast.kind}`} role="status" key={toast.id}>{toast.text}</div>}
      {printDoc && createPortal(printDoc, document.getElementById('print-root'))}
    </StoreContext.Provider>
  );
}

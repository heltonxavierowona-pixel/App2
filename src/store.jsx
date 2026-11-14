import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { emptyState } from './lib/logic.js';

const KEY = 'commerce-ai-v1';
const StoreContext = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch { /* stockage indisponible ou corrompu : on repart d'un état vide */ }
  return emptyState();
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota dépassé */ }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((text, kind = 'ok') => setToast({ text, kind, id: Date.now() }), []);

  // Applique une action pure ; renvoie true si elle a réussi, sinon affiche l'erreur.
  const run = useCallback((action, payload, okMessage) => {
    try {
      const next = action(state, payload);
      setState(next);
      if (okMessage) notify(okMessage);
      return true;
    } catch (e) {
      notify(e.message, 'error');
      return false;
    }
  }, [state, notify]);

  const fmt = useMemo(() => {
    const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
    return (n) => `${nf.format(Math.round(n || 0))} ${state.settings.currency}`;
  }, [state.settings.currency]);

  const value = useMemo(
    () => ({ state, setState, run, notify, fmt }),
    [state, run, notify, fmt],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status" key={toast.id}>{toast.text}</div>
      )}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);

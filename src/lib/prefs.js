// Réglages propres à ce poste de caisse (imprimante, impression automatique).
import { useCallback, useState } from 'react';

const KEY = 'numera-commercial:poste';
const DEFAULTS = { printFormat: 'ticket', autoPrint: false };

export function readPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULTS; }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(readPrefs);
  const update = useCallback((patch) => {
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  }, []);
  return [prefs, update];
}

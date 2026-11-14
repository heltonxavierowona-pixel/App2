// Petit stockage clé → valeur sur l'appareil (IndexedDB, avec repli sur localStorage).
const NAME = 'numera-commercial';
const STORE = 'kv';
let dbPromise = null;

function open() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet(key) {
  try { return (await tx('readonly', (s) => s.get(key))) ?? null; } catch {
    try { return JSON.parse(localStorage.getItem(`${NAME}:${key}`)); } catch { return null; }
  }
}

export async function kvSet(key, value) {
  try { await tx('readwrite', (s) => s.put(value, key)); } catch {
    try { localStorage.setItem(`${NAME}:${key}`, JSON.stringify(value)); } catch { /* stockage plein */ }
  }
}

export async function kvDel(key) {
  try { await tx('readwrite', (s) => s.delete(key)); } catch {
    try { localStorage.removeItem(`${NAME}:${key}`); } catch { /* rien */ }
  }
}

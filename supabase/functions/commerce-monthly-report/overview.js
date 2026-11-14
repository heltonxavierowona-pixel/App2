// Vue d'ensemble de plusieurs boutiques : résumé par boutique et total. Module pur, partagé
// entre l'application et la fonction serveur qui envoie les rapports mensuels.
import {
  metrics, topProducts, expensesByCategory, stockValue, totalDebt, totalSupplierDebt, lowStock,
} from './logic.js';

export const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Mois précédent, vu depuis un fuseau décalé de `offsetHours` par rapport à UTC.
export function previousMonthKey(now = new Date(), offsetHours = 0) {
  const local = new Date(now.getTime() + offsetHours * 3600000);
  const y = local.getUTCFullYear(), m = local.getUTCMonth(); // m : mois courant (0-11)
  return m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`;
}

// Bornes d'un mois 'AAAA-MM'. Sans décalage : heure locale de l'appareil.
// Avec `offsetHours` (serveur en UTC) : minuit dans le fuseau de la boutique.
export function monthBounds(key, offsetHours = null) {
  const [y, m] = key.split('-').map(Number);
  if (offsetHours == null) return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  const shift = offsetHours * 3600000;
  return { start: new Date(Date.UTC(y, m - 1, 1) - shift), end: new Date(Date.UTC(y, m, 1) - shift) };
}

export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export const money = (n, currency) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0))} ${currency}`;

export function shopSummary(state, key, offsetHours = null) {
  const { start, end } = monthBounds(key, offsetHours);
  const [y, m] = key.split('-').map(Number);
  const prev = monthBounds(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`, offsetHours);
  const low = lowStock(state);
  return {
    m: metrics(state, start, end),
    prev: metrics(state, prev.start, prev.end),
    top: topProducts(state, start, end, 5),
    expenses: expensesByCategory(state, start, end),
    stock: stockValue(state),
    debt: totalDebt(state),
    supplierDebt: totalSupplierDebt(state),
    lowCount: low.length,
    outCount: low.filter((p) => p.stock <= 0).length,
    closingGap: state.closings
      .filter((c) => new Date(c.date) >= start && new Date(c.date) < end)
      .reduce((s, c) => s + c.diff, 0),
  };
}

const SUM_KEYS = ['revenue', 'cogs', 'margin', 'expenses', 'net', 'salesCount', 'cashIn', 'purchases'];

// shops : [{ id, name, currency, state }] → lignes par boutique, total et classement.
// Le total n'est calculé que si toutes les boutiques ont la même devise.
export function consolidate(shops, key, offsetHours = null) {
  const rows = shops.map((shop) => ({
    id: shop.id, name: shop.name, currency: shop.currency ?? shop.state.settings.currency,
    ...shopSummary(shop.state, key, offsetHours),
  }));
  const currencies = [...new Set(rows.map((r) => r.currency))];
  const sum = (pick) => rows.reduce((s, r) => s + pick(r), 0);
  const total = currencies.length === 1 ? {
    currency: currencies[0],
    m: Object.fromEntries(SUM_KEYS.map((k) => [k, sum((r) => r.m[k])])),
    prev: Object.fromEntries(SUM_KEYS.map((k) => [k, sum((r) => r.prev[k])])),
    stockCost: sum((r) => r.stock.cost), debt: sum((r) => r.debt), supplierDebt: sum((r) => r.supplierDebt),
    lowCount: sum((r) => r.lowCount), outCount: sum((r) => r.outCount),
  } : null;
  if (total) total.m.marginRate = total.m.revenue > 0 ? total.m.margin / total.m.revenue : 0;
  return { key, label: monthLabel(key), rows, total, ranking: [...rows].sort((a, b) => b.m.revenue - a.m.revenue) };
}

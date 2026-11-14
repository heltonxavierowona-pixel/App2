// Jeu de données de démonstration (déterministe) pour découvrir l'application.
import {
  emptyState, saveProduct, saveCustomer, addSale, addExpense, addPayment, addMovement, addDays,
} from './logic.js';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = [
  // nom, code, catégorie, achat, vente, stock initial, seuil, popularité
  ['Baskets homme', 'CH-001', 'Chaussures', 9000, 15000, 30, 6, 5],
  ['Sandales femme', 'CH-002', 'Chaussures', 3500, 6000, 40, 8, 6],
  ['Chaussures enfant', 'CH-003', 'Chaussures', 4000, 7000, 14, 5, 3],
  ['T-shirt coton', 'VE-001', 'Vêtements', 1800, 3500, 80, 15, 9],
  ['Jean slim', 'VE-002', 'Vêtements', 6000, 10000, 28, 6, 4],
  ['Robe pagne', 'VE-003', 'Vêtements', 7000, 12000, 15, 4, 2],
  ['Chemise homme', 'VE-004', 'Vêtements', 4500, 8000, 25, 5, 3],
  ['Ceinture cuir', 'AC-001', 'Accessoires', 1500, 3000, 35, 8, 3],
  ['Sac à main', 'AC-002', 'Accessoires', 8000, 13000, 12, 3, 0],
  ['Casquette', 'AC-003', 'Accessoires', 1200, 2500, 45, 10, 4],
  ['Chaussettes (lot de 3)', 'AC-004', 'Accessoires', 950, 1000, 60, 12, 5],
];

export function demoState(now = new Date()) {
  const rand = rng(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const at = (daysAgo, hour) => {
    const d = addDays(now, -daysAgo);
    d.setHours(hour, Math.floor(rand() * 60), 0, 0);
    return d > now ? new Date(now.getTime() - 60000) : d;
  };

  let s = emptyState();
  s.settings.shopName = 'Boutique Démo';
  for (const [name, code, category, cost, price, stock, minStock] of PRODUCTS)
    s = saveProduct(s, { name, code, category, cost, price, stock, minStock, date: at(50, 8) });
  for (const [name, phone] of [
    ['Awa Diallo', '+237 6 90 00 00 01'], ['Jean Mbarga', '+237 6 90 00 00 02'],
    ['Fatou Ndiaye', '+237 6 90 00 00 03'], ['Paul Essomba', ''],
  ])
    s = saveCustomer(s, { name, phone, date: at(50, 9) });

  const weighted = PRODUCTS.flatMap((p, i) => Array(p[7]).fill(i));
  for (let day = 45; day >= 0; day--) {
    const weekday = addDays(now, -day).getDay();
    const count = 2 + Math.floor(rand() * 4) + (weekday === 6 ? 4 : 0);
    for (let k = 0; k < count; k++) {
      const items = [];
      const n = rand() < 0.3 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const p = s.products[pick(weighted)];
        const qty = 1 + (rand() < 0.2 ? 1 : 0);
        if (p.stock >= qty && !items.some((i) => i.productId === p.id))
          items.push({ productId: p.id, qty });
      }
      if (!items.length) continue;
      const r = rand();
      const payment = r < 0.55 ? 'cash' : r < 0.85 ? 'mobile' : r < 0.9 ? 'card' : 'credit';
      const subtotal = items.reduce(
        (t, i) => t + i.qty * s.products.find((p) => p.id === i.productId).price, 0);
      s = addSale(s, {
        items, payment,
        discount: rand() < 0.12 ? 500 : 0,
        customerId: payment === 'credit' ? pick(s.customers).id : null,
        paid: payment === 'credit' && rand() < 0.5 ? Math.round(subtotal / 2000) * 1000 : 0,
        date: at(day, 9 + Math.floor(rand() * 10)),
      });
    }
    // Réapprovisionnement de deux produits phares il y a trois semaines
    if (day === 21) {
      s = addMovement(s, { productId: s.products[3].id, type: 'in', qty: 40, reason: 'Livraison fournisseur', date: at(day, 8) });
      s = addMovement(s, { productId: s.products[1].id, type: 'in', qty: 20, reason: 'Livraison fournisseur', date: at(day, 8) });
    }
    if (day % 30 === 15) s = addExpense(s, { category: 'Loyer', amount: 60000, note: 'Loyer boutique', date: at(day, 10) });
    if (day % 7 === 3) s = addExpense(s, { category: 'Transport', amount: 5000 + Math.floor(rand() * 4) * 1000, note: 'Marché', date: at(day, 11) });
    if (day % 30 === 5) s = addExpense(s, { category: 'Électricité / Eau', amount: 18000, date: at(day, 12) });
    if (day === 10) s = addExpense(s, { category: 'Salaires', amount: 45000, note: 'Vendeuse', date: at(day, 17) });
  }
  // Un client a commencé à rembourser
  const debtor = s.customers.find((c) => s.sales.some((x) => x.customerId === c.id && x.total > x.paid));
  if (debtor) s = addPayment(s, { customerId: debtor.id, amount: 2000, method: 'mobile', date: at(2, 15) });
  return s;
}

// Logique métier pure de COMMERCE AI : aucune dépendance au navigateur,
// chaque action prend l'état et renvoie un nouvel état (ou lève une Error en français).

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const PAYMENTS = {
  cash: 'Espèces',
  mobile: 'Mobile Money',
  card: 'Carte',
  credit: 'Crédit (dette)',
};

export const EXPENSE_CATEGORIES = [
  'Loyer', 'Salaires', 'Transport', 'Électricité / Eau', 'Internet / Téléphone',
  'Taxes', 'Entretien', 'Autre',
];

export const emptyState = () => ({
  version: 1,
  settings: { shopName: 'Ma boutique', currency: 'FCFA' },
  products: [],
  sales: [],
  returns: [],
  movements: [],
  expenses: [],
  customers: [],
  payments: [],
});

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const fail = (msg) => { throw new Error(msg); };
const iso = (d) => (d ? new Date(d).toISOString() : new Date().toISOString());

// ---------- Produits ----------

export function saveProduct(state, input) {
  const name = String(input.name ?? '').trim();
  if (!name) fail('Le nom du produit est obligatoire.');
  const cost = num(input.cost), price = num(input.price);
  if (cost < 0 || price < 0) fail('Les prix doivent être positifs.');
  const code = String(input.code ?? '').trim();
  if (code && state.products.some((p) => p.code === code && p.id !== input.id && !p.archived))
    fail(`Le code « ${code} » est déjà utilisé.`);
  const fields = {
    name, code, cost, price,
    category: String(input.category ?? '').trim() || 'Divers',
    minStock: Math.max(0, num(input.minStock)),
  };
  if (input.id) {
    return {
      ...state,
      products: state.products.map((p) => (p.id === input.id ? { ...p, ...fields } : p)),
    };
  }
  const product = { id: uid(), ...fields, stock: 0, archived: false, createdAt: iso(input.date) };
  let next = { ...state, products: [...state.products, product] };
  const initial = num(input.stock);
  if (initial > 0)
    next = addMovement(next, {
      productId: product.id, type: 'in', qty: initial, reason: 'Stock initial', date: input.date,
    });
  return next;
}

export function deleteProduct(state, id) {
  const used =
    state.sales.some((s) => s.items.some((i) => i.productId === id));
  if (used)
    return { ...state, products: state.products.map((p) => (p.id === id ? { ...p, archived: true } : p)) };
  return {
    ...state,
    products: state.products.filter((p) => p.id !== id),
    movements: state.movements.filter((m) => m.productId !== id),
  };
}

// ---------- Stock ----------

// type : 'in' (entrée), 'out' (sortie), 'adjust' (inventaire : qty = nouveau stock réel)
export function addMovement(state, { productId, type, qty, reason, date, ref }) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) fail('Produit introuvable.');
  qty = num(qty);
  let delta;
  if (type === 'adjust') {
    if (qty < 0) fail('Le stock réel ne peut pas être négatif.');
    delta = qty - product.stock;
  } else {
    if (qty <= 0) fail('La quantité doit être supérieure à zéro.');
    delta = type === 'in' || type === 'return' ? qty : -qty;
  }
  if (product.stock + delta < 0)
    fail(`Stock insuffisant pour « ${product.name} » (disponible : ${product.stock}).`);
  const movement = {
    id: uid(), date: iso(date), productId, type, qty: delta,
    reason: String(reason ?? '').trim(), ref: ref ?? null,
  };
  return {
    ...state,
    products: state.products.map((p) => (p.id === productId ? { ...p, stock: p.stock + delta } : p)),
    movements: [...state.movements, movement],
  };
}

// ---------- Ventes ----------

export function addSale(state, { items, discount, payment, customerId, paid, date, note }) {
  if (!items?.length) fail('Ajoutez au moins un produit à la vente.');
  if (!PAYMENTS[payment]) fail('Mode de paiement invalide.');
  const lines = items.map((it) => {
    const product = state.products.find((p) => p.id === it.productId);
    if (!product) fail('Produit introuvable.');
    const qty = num(it.qty);
    if (qty <= 0) fail(`Quantité invalide pour « ${product.name} ».`);
    return {
      productId: product.id, name: product.name, qty,
      price: it.price == null ? product.price : num(it.price), cost: product.cost,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  discount = Math.max(0, num(discount));
  if (discount > subtotal) fail('La remise dépasse le montant de la vente.');
  const total = subtotal - discount;
  let paidAmount = total;
  if (payment === 'credit') {
    if (!customerId || !state.customers.some((c) => c.id === customerId))
      fail('Choisissez le client pour une vente à crédit.');
    paidAmount = Math.min(total, Math.max(0, num(paid)));
  }
  const sale = {
    id: uid(), date: iso(date), items: lines, subtotal, discount, total,
    payment, customerId: customerId || null, paid: paidAmount, note: String(note ?? '').trim(),
  };
  let next = state;
  for (const l of lines)
    next = addMovement(next, {
      productId: l.productId, type: 'sale', qty: l.qty, reason: 'Vente', date: sale.date, ref: sale.id,
    });
  return { ...next, sales: [...next.sales, sale] };
}

export const returnedQty = (state, saleId, productId) =>
  state.returns
    .filter((r) => r.saleId === saleId && r.productId === productId)
    .reduce((s, r) => s + r.qty, 0);

// Retour d'un article : remet en stock, et rembourse (en réduisant d'abord la dette de cette vente).
export function addReturn(state, { saleId, productId, qty, date }) {
  const sale = state.sales.find((s) => s.id === saleId);
  const item = sale?.items.find((i) => i.productId === productId);
  if (!item) fail('Vente ou article introuvable.');
  qty = num(qty);
  const max = item.qty - returnedQty(state, saleId, productId);
  if (qty <= 0 || qty > max) fail(`Quantité de retour invalide (maximum : ${max}).`);
  const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
  const amount = Math.round(item.price * ratio * qty);
  const alreadyCredited = state.returns
    .filter((r) => r.saleId === saleId)
    .reduce((s, r) => s + r.creditedToDebt, 0);
  const saleDue = Math.max(0, sale.total - sale.paid - alreadyCredited);
  const balance = sale.customerId ? Math.max(0, customerBalance(state, sale.customerId)) : 0;
  const creditedToDebt = Math.min(amount, saleDue, balance);
  const ret = {
    id: uid(), date: iso(date), saleId, productId, name: item.name, qty,
    amount, cost: item.cost * qty, creditedToDebt, refunded: amount - creditedToDebt,
  };
  let next = state;
  if (state.products.some((p) => p.id === productId))
    next = addMovement(next, {
      productId, type: 'return', qty, reason: 'Retour client', date: ret.date, ref: saleId,
    });
  return { ...next, returns: [...next.returns, ret] };
}

// ---------- Dépenses ----------

export function addExpense(state, { category, amount, note, date }) {
  amount = num(amount);
  if (amount <= 0) fail('Le montant de la dépense doit être supérieur à zéro.');
  const expense = {
    id: uid(), date: iso(date), amount,
    category: String(category ?? '').trim() || 'Autre', note: String(note ?? '').trim(),
  };
  return { ...state, expenses: [...state.expenses, expense] };
}

export const deleteExpense = (state, id) => ({
  ...state, expenses: state.expenses.filter((e) => e.id !== id),
});

// ---------- Clients & dettes ----------

export function saveCustomer(state, input) {
  const name = String(input.name ?? '').trim();
  if (!name) fail('Le nom du client est obligatoire.');
  const fields = { name, phone: String(input.phone ?? '').trim() };
  if (input.id)
    return { ...state, customers: state.customers.map((c) => (c.id === input.id ? { ...c, ...fields } : c)) };
  return { ...state, customers: [...state.customers, { id: uid(), ...fields, createdAt: iso(input.date) }] };
}

export function deleteCustomer(state, id) {
  if (state.sales.some((s) => s.customerId === id) || state.payments.some((p) => p.customerId === id))
    fail('Ce client a un historique : il ne peut pas être supprimé.');
  return { ...state, customers: state.customers.filter((c) => c.id !== id) };
}

export function customerBalance(state, customerId) {
  const saleIds = new Set();
  let due = 0;
  for (const s of state.sales)
    if (s.customerId === customerId) { saleIds.add(s.id); due += s.total - s.paid; }
  for (const r of state.returns) if (saleIds.has(r.saleId)) due -= r.creditedToDebt;
  for (const p of state.payments) if (p.customerId === customerId) due -= p.amount;
  return due;
}

export function addPayment(state, { customerId, amount, method, note, date }) {
  if (!state.customers.some((c) => c.id === customerId)) fail('Client introuvable.');
  amount = num(amount);
  if (amount <= 0) fail('Le montant du règlement doit être supérieur à zéro.');
  const balance = customerBalance(state, customerId);
  if (amount > balance) fail(`Le règlement dépasse la dette du client (${balance}).`);
  const payment = {
    id: uid(), date: iso(date), customerId, amount,
    method: method && method !== 'credit' && PAYMENTS[method] ? method : 'cash',
    note: String(note ?? '').trim(),
  };
  return { ...state, payments: [...state.payments, payment] };
}

// ---------- Périodes & indicateurs ----------

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// period : 'day' | 'week' (depuis lundi) | 'month' (depuis le 1er)
export function periodRange(period, now = new Date()) {
  const today = startOfDay(now);
  const end = addDays(today, 1);
  let start = today, prevStart, prevEnd;
  if (period === 'week') {
    start = addDays(today, -((today.getDay() + 6) % 7));
    prevStart = addDays(start, -7);
  } else if (period === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  } else {
    prevStart = addDays(today, -1);
  }
  prevEnd = start;
  return { start, end, prevStart, prevEnd };
}

const within = (dateIso, start, end) => {
  const t = new Date(dateIso).getTime();
  return t >= start.getTime() && t < end.getTime();
};

export function metrics(state, start, end) {
  const m = {
    revenue: 0, cogs: 0, expenses: 0, salesCount: 0, units: 0, discounts: 0,
    cashIn: 0, creditGiven: 0, byPayment: { cash: 0, mobile: 0, card: 0, credit: 0 },
  };
  for (const s of state.sales) {
    if (!within(s.date, start, end)) continue;
    m.revenue += s.total;
    m.discounts += s.discount;
    m.salesCount += 1;
    m.cashIn += s.paid;
    m.creditGiven += s.total - s.paid;
    m.byPayment[s.payment] += s.total;
    for (const i of s.items) { m.cogs += i.qty * i.cost; m.units += i.qty; }
  }
  for (const r of state.returns) {
    if (!within(r.date, start, end)) continue;
    m.revenue -= r.amount;
    m.cogs -= r.cost;
    m.units -= r.qty;
    m.cashIn -= r.refunded;
  }
  for (const p of state.payments) if (within(p.date, start, end)) m.cashIn += p.amount;
  for (const e of state.expenses) if (within(e.date, start, end)) m.expenses += e.amount;
  m.margin = m.revenue - m.cogs;
  m.net = m.margin - m.expenses;
  m.marginRate = m.revenue > 0 ? m.margin / m.revenue : 0;
  return m;
}

export function topProducts(state, start, end, limit = 5) {
  const map = new Map();
  const get = (id, name) => {
    if (!map.has(id)) map.set(id, { productId: id, name, qty: 0, revenue: 0, margin: 0 });
    return map.get(id);
  };
  for (const s of state.sales) {
    if (!within(s.date, start, end)) continue;
    const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1;
    for (const i of s.items) {
      const row = get(i.productId, i.name);
      row.qty += i.qty;
      row.revenue += i.qty * i.price * ratio;
      row.margin += i.qty * (i.price * ratio - i.cost);
    }
  }
  for (const r of state.returns) {
    if (!within(r.date, start, end)) continue;
    const row = get(r.productId, r.name);
    row.qty -= r.qty; row.revenue -= r.amount; row.margin -= r.amount - r.cost;
  }
  return [...map.values()].filter((r) => r.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, limit);
}

// Chiffre d'affaires net par jour sur les `days` derniers jours (aujourd'hui inclus).
export function dailySeries(state, days, now = new Date()) {
  const first = addDays(startOfDay(now), -(days - 1));
  return Array.from({ length: days }, (_, k) => {
    const start = addDays(first, k);
    const m = metrics(state, start, addDays(start, 1));
    return { date: start, revenue: m.revenue, margin: m.margin, salesCount: m.salesCount };
  });
}

export const stockValue = (state) =>
  state.products.filter((p) => !p.archived).reduce(
    (acc, p) => ({ cost: acc.cost + p.stock * p.cost, retail: acc.retail + p.stock * p.price }),
    { cost: 0, retail: 0 },
  );

export const lowStock = (state) =>
  state.products
    .filter((p) => !p.archived && p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock);

export const totalDebt = (state) =>
  state.customers.reduce((s, c) => s + Math.max(0, customerBalance(state, c.id)), 0);

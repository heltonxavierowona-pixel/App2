// Logique métier pure de NUMERA COMMERCIAL AI : aucune dépendance au navigateur.
// Chaque action prend l'état et renvoie un nouvel état (ou lève une Error en français).
//
// Les actions sont rejouables : appliquée via applyOp, une même opération produit toujours
// le même résultat (mêmes identifiants, mêmes dates), ce qui permet la synchronisation
// entre appareils par simple journal d'opérations.

let ctx = null; // contexte de l'opération en cours : { id, ts, user, lenient, n }

export const uid = () => {
  if (ctx) return `${ctx.id}-${ctx.n++}`;
  return globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36);
};

export const PAYMENTS = {
  cash: 'Espèces',
  mobile: 'Mobile Money',
  card: 'Carte',
  credit: 'Crédit (dette)',
};
export const PAY_NOW = Object.fromEntries(Object.entries(PAYMENTS).filter(([k]) => k !== 'credit'));

// Unités de vente : à la pièce, ou au poids / au volume / à la longueur (quantités décimales).
export const UNITS = { unit: 'pièce', kg: 'kg', g: 'g', l: 'L', m: 'm' };
export const isMeasured = (p) => Boolean(p?.unit && p.unit !== 'unit');
const r3 = (n) => Math.round(n * 1000) / 1000;
export const fmtQty = (qty, unit) =>
  `${r3(qty).toLocaleString('fr-FR', { maximumFractionDigits: 3 })}${unit && unit !== 'unit' ? ` ${UNITS[unit]}` : ''}`;

export const EXPENSE_CATEGORIES = [
  'Loyer', 'Salaires', 'Transport', 'Électricité / Eau', 'Internet / Téléphone',
  'Taxes', 'Entretien', 'Autre',
];

export const emptyState = (shopName = 'Ma boutique', currency = 'FCFA') => ({
  version: 2,
  settings: { shopName, currency, phone: '', address: '' },
  counters: { invoice: 0 },
  products: [],
  sales: [],
  returns: [],
  movements: [],
  expenses: [],
  customers: [],
  payments: [],
  suppliers: [],
  purchases: [],
  supplierPayments: [],
  closings: [],
});

// Complète un état ancien ou partiel avec les champs manquants.
export const normalize = (data, shopName, currency) => {
  const base = emptyState(shopName, currency);
  const s = { ...base, ...data };
  s.settings = { ...base.settings, ...data?.settings };
  s.counters = { ...base.counters, ...data?.counters };
  return s;
};

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const str = (v) => String(v ?? '').trim();
const fail = (msg) => { throw new Error(msg); };
const iso = (d) => (d ? new Date(d).toISOString() : ctx?.ts ?? new Date().toISOString());
const lenient = () => Boolean(ctx?.lenient);
const payNow = (m) => (PAY_NOW[m] ? m : 'cash');

// ---------- Produits & variantes ----------

export const hasVariants = (p) => (p?.variants?.length ?? 0) > 0;
export const lineName = (p, variant) => (variant ? `${p.name} (${variant.label})` : p.name);

export function saveProduct(state, input) {
  const name = str(input.name);
  if (!name) fail('Le nom du produit est obligatoire.');
  const cost = num(input.cost), price = num(input.price);
  if (cost < 0 || price < 0) fail('Les prix doivent être positifs.');
  const code = str(input.code);
  if (code && state.products.some((p) => p.code === code && p.id !== input.id && !p.archived))
    fail(`Le code « ${code} » est déjà utilisé.`);
  const barcode = str(input.barcode);
  const fields = {
    name, code, barcode, cost, price,
    category: str(input.category) || 'Divers',
    minStock: Math.max(0, num(input.minStock)),
    unit: UNITS[input.unit] ? input.unit : 'unit',
  };
  if (fields.unit !== 'unit' && (input.variants ?? []).some((v) => str(v.label)))
    fail('Un produit vendu au poids ne peut pas avoir de variantes.');
  const wanted = (input.variants ?? [])
    .map((v) => ({ id: v.id, label: str(v.label), barcode: str(v.barcode), stock: num(v.stock) }))
    .filter((v) => v.label);
  if (new Set(wanted.map((v) => v.label.toLowerCase())).size !== wanted.length)
    fail('Deux variantes portent le même nom.');

  if (input.id) {
    const existing = state.products.find((p) => p.id === input.id);
    if (!existing) fail('Produit introuvable.');
    const old = existing.variants ?? [];
    if (!old.length && wanted.length && existing.stock > 0)
      fail('Ramenez le stock à zéro (inventaire) avant de passer ce produit en variantes.');
    for (const v of old)
      if (v.stock !== 0 && !wanted.some((w) => w.id === v.id))
        fail(`La variante « ${v.label} » a encore du stock : elle ne peut pas être retirée.`);
    const variants = wanted.map((w) => {
      const prev = old.find((v) => v.id === w.id);
      return { id: prev?.id ?? uid(), label: w.label, barcode: w.barcode, stock: prev?.stock ?? 0 };
    });
    return {
      ...state,
      products: state.products.map((p) => (p.id === input.id ? { ...p, ...fields, variants } : p)),
    };
  }

  const variants = wanted.map((w) => ({ id: uid(), label: w.label, barcode: w.barcode, stock: 0 }));
  const product = {
    id: uid(), ...fields, variants, stock: 0, archived: false, createdAt: iso(input.date),
  };
  let next = { ...state, products: [...state.products, product] };
  const initial = variants.length
    ? variants.map((v, i) => ({ variantId: v.id, qty: wanted[i].stock }))
    : [{ variantId: null, qty: num(input.stock) }];
  for (const { variantId, qty } of initial)
    if (qty > 0)
      next = addMovement(next, {
        productId: product.id, variantId, type: 'in', qty, reason: 'Stock initial', date: input.date,
      });
  return next;
}

export function deleteProduct(state, id) {
  const used =
    state.sales.some((s) => s.items.some((i) => i.productId === id)) ||
    state.purchases.some((p) => p.items.some((i) => i.productId === id));
  if (used)
    return { ...state, products: state.products.map((p) => (p.id === id ? { ...p, archived: true } : p)) };
  return {
    ...state,
    products: state.products.filter((p) => p.id !== id),
    movements: state.movements.filter((m) => m.productId !== id),
  };
}

// Retrouve un produit (et sa variante) par code-barres ou code interne.
export function findByCode(state, code) {
  code = str(code);
  if (!code) return null;
  for (const p of state.products) {
    if (p.archived) continue;
    const variant = p.variants?.find((v) => v.barcode === code);
    if (variant) return { product: p, variant };
    if (p.barcode === code || p.code === code) return { product: p, variant: null };
  }
  return findWeightLabel(state, code);
}

// Étiquette de balance (EAN-13 commençant par 2) : 2X + 5 chiffres d'article + 5 chiffres de poids
// en grammes + clé. L'article est reconnu par son code interne ou par les 7 premiers chiffres.
function findWeightLabel(state, code) {
  if (!/^2\d{12}$/.test(code)) return null;
  const item = code.slice(2, 7), prefix = code.slice(0, 7), grams = Number(code.slice(7, 12));
  const product = state.products.find((p) =>
    !p.archived && isMeasured(p) && (p.code === item || p.code === String(Number(item)) || p.barcode === prefix));
  if (!product || !grams) return null;
  const qty = product.unit === 'g' ? grams : r3(grams / 1000);
  return { product, variant: null, qty };
}

// ---------- Stock ----------

// type : 'in' (entrée), 'out' (sortie), 'adjust' (inventaire : qty = nouveau stock réel),
//        'sale', 'return', 'purchase' (créés par les ventes, retours et achats)
export function addMovement(state, { productId, variantId, type, qty, reason, date, ref }) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) fail('Produit introuvable.');
  let variant = null;
  if (hasVariants(product)) {
    variant = product.variants.find((v) => v.id === variantId);
    if (!variant) fail(`Choisissez la variante de « ${product.name} ».`);
  }
  const current = variant ? variant.stock : product.stock;
  qty = num(qty);
  let delta;
  if (type === 'adjust') {
    if (qty < 0) fail('Le stock réel ne peut pas être négatif.');
    delta = qty - current;
  } else {
    if (qty <= 0) fail('La quantité doit être supérieure à zéro.');
    delta = type === 'in' || type === 'return' || type === 'purchase' ? qty : -qty;
  }
  if (current + delta < 0 && !lenient())
    fail(`Stock insuffisant pour « ${lineName(product, variant)} » (disponible : ${current}).`);
  const movement = {
    id: uid(), date: iso(date), productId, variantId: variant?.id ?? null, type, qty: r3(delta),
    reason: str(reason), ref: ref ?? null,
  };
  return {
    ...state,
    products: state.products.map((p) => (p.id !== productId ? p : {
      ...p,
      stock: r3(p.stock + delta),
      variants: (p.variants ?? []).map((v) => (v.id === variant?.id ? { ...v, stock: r3(v.stock + delta) } : v)),
    })),
    movements: [...state.movements, movement],
  };
}

// ---------- Ventes ----------

export function addSale(state, { items, discount, payment, customerId, paid, received, date, note }) {
  if (!items?.length) fail('Ajoutez au moins un produit à la vente.');
  if (!PAYMENTS[payment]) fail('Mode de paiement invalide.');
  const lines = items.map((it) => {
    const product = state.products.find((p) => p.id === it.productId);
    if (!product) fail('Produit introuvable.');
    const variant = product.variants?.find((v) => v.id === it.variantId) ?? null;
    const qty = num(it.qty);
    if (qty <= 0) fail(`Quantité invalide pour « ${product.name} ».`);
    if (!isMeasured(product) && !Number.isInteger(qty))
      fail(`« ${product.name} » se vend à la pièce : la quantité doit être entière.`);
    return {
      id: uid(), productId: product.id, variantId: variant?.id ?? null,
      name: lineName(product, variant), qty: r3(qty), unit: product.unit ?? 'unit',
      price: it.price == null ? product.price : num(it.price), cost: product.cost,
    };
  });
  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0));
  discount = Math.max(0, num(discount));
  if (discount > subtotal) fail('La remise dépasse le montant de la vente.');
  const total = subtotal - discount;
  let paidAmount = total;
  if (payment === 'credit') {
    if (!customerId || !state.customers.some((c) => c.id === customerId))
      fail('Choisissez le client pour une vente à crédit.');
    paidAmount = Math.min(total, Math.max(0, num(paid)));
  }
  // Espèces remises par le client (pour la monnaie à rendre sur le ticket).
  const given = payment === 'cash' && num(received) >= total ? num(received) : null;
  const saleDate = iso(date);
  const invoice = state.counters.invoice + 1;
  const sale = {
    id: uid(), date: saleDate,
    number: `FA-${new Date(saleDate).getFullYear()}-${String(invoice).padStart(5, '0')}`,
    items: lines, subtotal, discount, total,
    payment, customerId: customerId || null, paid: paidAmount, note: str(note),
    received: given, change: given == null ? null : given - total,
    seller: ctx?.user ?? '',
  };
  let next = state;
  for (const l of lines)
    next = addMovement(next, {
      productId: l.productId, variantId: l.variantId, type: 'sale', qty: l.qty,
      reason: 'Vente', date: sale.date, ref: sale.id,
    });
  return { ...next, counters: { ...next.counters, invoice }, sales: [...next.sales, sale] };
}

export const returnedQty = (state, saleId, lineId) =>
  state.returns
    .filter((r) => r.saleId === saleId && r.lineId === lineId)
    .reduce((s, r) => s + r.qty, 0);

// Retour d'un article : remet en stock, et rembourse (en réduisant d'abord la dette de cette vente).
export function addReturn(state, { saleId, lineId, qty, date }) {
  const sale = state.sales.find((s) => s.id === saleId);
  const item = sale?.items.find((i) => i.id === lineId);
  if (!item) fail('Vente ou article introuvable.');
  qty = num(qty);
  const max = item.qty - returnedQty(state, saleId, lineId);
  if (qty <= 0 || qty > max + 1e-9) fail(`Quantité de retour invalide (maximum : ${r3(max)}).`);
  const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
  const amount = Math.round(item.price * ratio * qty);
  const alreadyCredited = state.returns
    .filter((r) => r.saleId === saleId)
    .reduce((s, r) => s + r.creditedToDebt, 0);
  const saleDue = Math.max(0, sale.total - sale.paid - alreadyCredited);
  const balance = sale.customerId ? Math.max(0, customerBalance(state, sale.customerId)) : 0;
  const creditedToDebt = Math.min(amount, saleDue, balance);
  const ret = {
    id: uid(), date: iso(date), saleId, lineId, productId: item.productId,
    variantId: item.variantId, name: item.name, qty,
    amount, cost: Math.round(item.cost * qty), creditedToDebt, refunded: amount - creditedToDebt,
  };
  let next = state;
  const product = state.products.find((p) => p.id === item.productId);
  const variantOk = !hasVariants(product) || product.variants.some((v) => v.id === item.variantId);
  if (product && variantOk)
    next = addMovement(next, {
      productId: item.productId, variantId: item.variantId, type: 'return', qty,
      reason: 'Retour client', date: ret.date, ref: saleId,
    });
  return { ...next, returns: [...next.returns, ret] };
}

// ---------- Dépenses ----------

export function addExpense(state, { category, amount, note, date, method }) {
  amount = num(amount);
  if (amount <= 0) fail('Le montant de la dépense doit être supérieur à zéro.');
  const expense = {
    id: uid(), date: iso(date), amount, method: payNow(method),
    category: str(category) || 'Autre', note: str(note),
  };
  return { ...state, expenses: [...state.expenses, expense] };
}

export const deleteExpense = (state, id) => ({
  ...state, expenses: state.expenses.filter((e) => e.id !== id),
});

// ---------- Clients & dettes ----------

export function saveCustomer(state, input) {
  const name = str(input.name);
  if (!name) fail('Le nom du client est obligatoire.');
  const fields = { name, phone: str(input.phone) };
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
  if (amount > balance && !lenient()) fail(`Le règlement dépasse la dette du client (${balance}).`);
  const payment = {
    id: uid(), date: iso(date), customerId, amount, method: payNow(method), note: str(note),
  };
  return { ...state, payments: [...state.payments, payment] };
}

// ---------- Fournisseurs & achats ----------

export function saveSupplier(state, input) {
  const name = str(input.name);
  if (!name) fail('Le nom du fournisseur est obligatoire.');
  const fields = { name, phone: str(input.phone) };
  if (input.id)
    return { ...state, suppliers: state.suppliers.map((s) => (s.id === input.id ? { ...s, ...fields } : s)) };
  return { ...state, suppliers: [...state.suppliers, { id: uid(), ...fields, createdAt: iso(input.date) }] };
}

export function deleteSupplier(state, id) {
  if (state.purchases.some((p) => p.supplierId === id) || state.supplierPayments.some((p) => p.supplierId === id))
    fail('Ce fournisseur a un historique : il ne peut pas être supprimé.');
  return { ...state, suppliers: state.suppliers.filter((s) => s.id !== id) };
}

// Achat fournisseur : entre la marchandise en stock et met à jour le prix d'achat
// (coût moyen pondéré). `paid` = montant réglé tout de suite, le reste devient une dette fournisseur.
export function addPurchase(state, { supplierId, items, paid, method, date, note }) {
  if (!state.suppliers.some((s) => s.id === supplierId)) fail('Choisissez le fournisseur.');
  if (!items?.length) fail("Ajoutez au moins un produit à l'achat.");
  const purchaseDate = iso(date);
  const id = uid();
  let next = state;
  const lines = items.map((it) => {
    const product = next.products.find((p) => p.id === it.productId);
    if (!product) fail('Produit introuvable.');
    const variant = product.variants?.find((v) => v.id === it.variantId) ?? null;
    const qty = num(it.qty), cost = num(it.cost);
    if (qty <= 0) fail(`Quantité invalide pour « ${product.name} ».`);
    if (cost < 0) fail(`Prix d'achat invalide pour « ${product.name} ».`);
    const before = Math.max(0, product.stock);
    const average = Math.round((before * product.cost + qty * cost) / (before + qty));
    next = addMovement(next, {
      productId: product.id, variantId: it.variantId, type: 'purchase', qty,
      reason: 'Achat fournisseur', date: purchaseDate, ref: id,
    });
    next = { ...next, products: next.products.map((p) => (p.id === product.id ? { ...p, cost: average } : p)) };
    return { productId: product.id, variantId: variant?.id ?? null, name: lineName(product, variant), qty, cost };
  });
  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0);
  const purchase = {
    id, date: purchaseDate, supplierId, items: lines, total,
    paid: Math.min(total, Math.max(0, paid == null || paid === '' ? total : num(paid))),
    method: payNow(method), note: str(note),
  };
  return { ...next, purchases: [...next.purchases, purchase] };
}

export function supplierBalance(state, supplierId) {
  let due = 0;
  for (const p of state.purchases) if (p.supplierId === supplierId) due += p.total - p.paid;
  for (const p of state.supplierPayments) if (p.supplierId === supplierId) due -= p.amount;
  return due;
}

export function addSupplierPayment(state, { supplierId, amount, method, note, date }) {
  if (!state.suppliers.some((s) => s.id === supplierId)) fail('Fournisseur introuvable.');
  amount = num(amount);
  if (amount <= 0) fail('Le montant du paiement doit être supérieur à zéro.');
  const balance = supplierBalance(state, supplierId);
  if (amount > balance && !lenient()) fail(`Le paiement dépasse ce que vous devez à ce fournisseur (${balance}).`);
  const payment = { id: uid(), date: iso(date), supplierId, amount, method: payNow(method), note: str(note) };
  return { ...state, supplierPayments: [...state.supplierPayments, payment] };
}

export const totalSupplierDebt = (state) =>
  state.suppliers.reduce((s, x) => s + Math.max(0, supplierBalance(state, x.id)), 0);

// ---------- Clôture de caisse ----------

// Espèces attendues dans le tiroir depuis la dernière clôture.
// Les acomptes des ventes à crédit et les remboursements de retours sont comptés en espèces.
export function cashExpected(state, until) {
  const last = state.closings.at(-1);
  const from = last ? new Date(last.date).getTime() : 0;
  const to = until ? new Date(until).getTime() : Infinity;
  const inRange = (d) => { const t = new Date(d).getTime(); return t > from && t <= to; };
  const b = { opening: last?.kept ?? 0, sales: 0, debtPayments: 0, refunds: 0, expenses: 0, suppliers: 0 };
  for (const s of state.sales)
    if (inRange(s.date) && (s.payment === 'cash' || s.payment === 'credit')) b.sales += s.paid;
  for (const p of state.payments) if (inRange(p.date) && p.method === 'cash') b.debtPayments += p.amount;
  for (const r of state.returns) if (inRange(r.date)) b.refunds += r.refunded;
  for (const e of state.expenses) if (inRange(e.date) && (e.method ?? 'cash') === 'cash') b.expenses += e.amount;
  for (const p of state.purchases) if (inRange(p.date) && p.method === 'cash') b.suppliers += p.paid;
  for (const p of state.supplierPayments) if (inRange(p.date) && p.method === 'cash') b.suppliers += p.amount;
  b.expected = b.opening + b.sales + b.debtPayments - b.refunds - b.expenses - b.suppliers;
  return b;
}

// counted : espèces comptées ; kept : fond de caisse laissé dans le tiroir pour la suite.
export function addClosing(state, { counted, kept, note, date }) {
  if (counted === '' || counted == null) fail('Saisissez le montant compté dans la caisse.');
  counted = num(counted);
  if (counted < 0) fail('Le montant compté ne peut pas être négatif.');
  kept = kept === '' || kept == null ? 0 : num(kept);
  if (kept < 0 || kept > counted) fail('Le fond de caisse doit être compris entre zéro et le montant compté.');
  const closingDate = iso(date);
  const breakdown = cashExpected(state, closingDate);
  const closing = {
    id: uid(), date: closingDate, ...breakdown, counted, kept,
    diff: counted - breakdown.expected, withdrawn: counted - kept,
    note: str(note), user: ctx?.user ?? '',
  };
  return { ...state, closings: [...state.closings, closing] };
}

// ---------- Réglages & données ----------

// Le nom de la boutique est fixé à l'ouverture du compte : il ne se modifie pas ici.
export function updateSettings(state, { currency, phone, address }) {
  return {
    ...state,
    settings: {
      ...state.settings,
      currency: str(currency) || state.settings.currency,
      phone: str(phone), address: str(address),
    },
  };
}

// Remplace toutes les données (restauration, démo, remise à zéro) en gardant le nom de la boutique.
export function replaceAll(state, { data }) {
  const next = normalize(data, state.settings.shopName, state.settings.currency);
  next.settings.shopName = state.settings.shopName;
  return next;
}

// ---------- Journal d'opérations ----------

export const ACTIONS = {
  saveProduct, deleteProduct, addMovement, addSale, addReturn, addExpense, deleteExpense,
  saveCustomer, deleteCustomer, addPayment, saveSupplier, deleteSupplier, addPurchase,
  addSupplierPayment, addClosing, updateSettings, replaceAll,
};
const NAMES = new Map(Object.entries(ACTIONS).map(([name, fn]) => [fn, name]));
export const actionName = (fn) => NAMES.get(fn);

// Rôles : le patron ('owner') peut tout faire ; le gérant ('manager') gère sa boutique sans pouvoir
// en remplacer toutes les données ; le vendeur ('seller') encaisse et clôture la caisse.
export const ROLES = { owner: 'Patron', manager: 'Gérant', seller: 'Vendeur' };
export const SELLER_ACTIONS = ['addSale', 'addReturn', 'saveCustomer', 'addPayment', 'addClosing'];
export const MANAGER_FORBIDDEN = ['replaceAll', 'updateSettings'];
export const canDo = (role, action) =>
  role === 'owner' ||
  (role === 'manager' && !MANAGER_FORBIDDEN.includes(action)) ||
  (role === 'seller' && SELLER_ACTIONS.includes(action));

// op : { id, ts, user, action, payload }. `lenient` : rejoue une opération déjà acceptée
// ailleurs sans la refuser pour stock insuffisant (la vente a réellement eu lieu).
export function applyOp(state, op, { lenient: isLenient = false } = {}) {
  const action = ACTIONS[op.action];
  if (!action) fail(`Opération inconnue : ${op.action}`);
  const prev = ctx;
  ctx = { id: op.id, ts: op.ts, user: op.user ?? '', lenient: isLenient, n: 0 };
  try { return action(state, op.payload); } finally { ctx = prev; }
}

// ---------- Périodes & indicateurs ----------

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// period : 'day' | 'week' (depuis lundi) | 'month' (depuis le 1er)
export function periodRange(period, now = new Date()) {
  const today = startOfDay(now);
  const end = addDays(today, 1);
  let start = today, prevStart;
  if (period === 'week') {
    start = addDays(today, -((today.getDay() + 6) % 7));
    prevStart = addDays(start, -7);
  } else if (period === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  } else {
    prevStart = addDays(today, -1);
  }
  return { start, end, prevStart, prevEnd: start };
}

// Mois civil : 'AAAA-MM' → { start, end }
export function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

const within = (dateIso, start, end) => {
  const t = new Date(dateIso).getTime();
  return t >= start.getTime() && t < end.getTime();
};

export function metrics(state, start, end) {
  const m = {
    revenue: 0, cogs: 0, expenses: 0, salesCount: 0, units: 0, discounts: 0,
    cashIn: 0, creditGiven: 0, purchases: 0, byPayment: { cash: 0, mobile: 0, card: 0, credit: 0 },
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
  for (const p of state.purchases) if (within(p.date, start, end)) m.purchases += p.total;
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
  const baseName = (id, fallback) => state.products.find((p) => p.id === id)?.name ?? fallback;
  for (const s of state.sales) {
    if (!within(s.date, start, end)) continue;
    const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1;
    for (const i of s.items) {
      const row = get(i.productId, baseName(i.productId, i.name));
      row.qty += i.qty;
      row.revenue += i.qty * i.price * ratio;
      row.margin += i.qty * (i.price * ratio - i.cost);
    }
  }
  for (const r of state.returns) {
    if (!within(r.date, start, end)) continue;
    const row = get(r.productId, baseName(r.productId, r.name));
    row.qty -= r.qty; row.revenue -= r.amount; row.margin -= r.amount - r.cost;
  }
  return [...map.values()].filter((r) => r.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function expensesByCategory(state, start, end) {
  const map = new Map();
  for (const e of state.expenses)
    if (within(e.date, start, end)) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, saveProduct, addMovement, addSale, addReturn, addExpense, saveCustomer,
  addPayment, customerBalance, metrics, topProducts, periodRange, lowStock, deleteProduct,
  saveSupplier, addPurchase, addSupplierPayment, supplierBalance, addClosing, cashExpected,
  applyOp, canDo, findByCode, replaceAll, updateSettings, actionName,
} from '../src/lib/logic.js';
import { insights } from '../src/lib/insights.js';
import { demoState } from '../src/lib/demo.js';

const far = [new Date(2000, 0, 1), new Date(2100, 0, 1)];

function shop() {
  let s = emptyState('Chez Awa');
  s = saveProduct(s, { name: 'Basket', code: 'B1', cost: 6000, price: 10000, stock: 10, minStock: 3 });
  s = saveProduct(s, { name: 'T-shirt', code: 'T1', cost: 2000, price: 3000, stock: 5, minStock: 5 });
  s = saveCustomer(s, { name: 'Awa' });
  return s;
}

test('création de produit avec stock initial et code unique', () => {
  const s = shop();
  assert.equal(s.products[0].stock, 10);
  assert.equal(s.movements.length, 2);
  assert.throws(() => saveProduct(s, { name: 'Autre', code: 'B1' }), /déjà utilisé/);
  assert.deepEqual(lowStock(s).map((p) => p.name), ['T-shirt']);
});

test('une vente diminue le stock, numérote la facture et calcule la marge', () => {
  let s = shop();
  const [b, t] = s.products;
  s = addSale(s, {
    items: [{ productId: b.id, qty: 2 }, { productId: t.id, qty: 1 }], discount: 1000, payment: 'cash',
  });
  assert.equal(s.products[0].stock, 8);
  assert.equal(s.sales[0].total, 22000);
  assert.match(s.sales[0].number, /^FA-\d{4}-00001$/);
  s = addSale(s, { items: [{ productId: t.id, qty: 1 }], payment: 'mobile' });
  assert.match(s.sales[1].number, /-00002$/);
  const m = metrics(s, ...far);
  assert.equal(m.revenue, 25000);
  assert.equal(m.cogs, 16000);
  assert.equal(m.cashIn, 25000);
  assert.equal(topProducts(s, ...far)[0].name, 'Basket');
});

test("vente refusée si stock insuffisant, sans modifier l'état", () => {
  const s = shop();
  assert.throws(
    () => addSale(s, { items: [{ productId: s.products[1].id, qty: 6 }], payment: 'cash' }),
    /Stock insuffisant/);
  assert.equal(s.products[1].stock, 5);
});

test('vente à crédit, règlements et solde client', () => {
  let s = shop();
  const c = s.customers[0];
  assert.throws(
    () => addSale(s, { items: [{ productId: s.products[0].id, qty: 1 }], payment: 'credit' }),
    /client/);
  s = addSale(s, {
    items: [{ productId: s.products[0].id, qty: 1 }], payment: 'credit', customerId: c.id, paid: 4000,
  });
  assert.equal(customerBalance(s, c.id), 6000);
  assert.throws(() => addPayment(s, { customerId: c.id, amount: 7000 }), /dépasse/);
  s = addPayment(s, { customerId: c.id, amount: 2500, method: 'mobile' });
  assert.equal(customerBalance(s, c.id), 3500);
  assert.equal(metrics(s, ...far).cashIn, 6500);
});

test("un retour remet en stock et réduit d'abord la dette", () => {
  let s = shop();
  const c = s.customers[0], b = s.products[0];
  s = addSale(s, { items: [{ productId: b.id, qty: 2 }], payment: 'credit', customerId: c.id, paid: 15000 });
  const lineId = s.sales[0].items[0].id;
  s = addReturn(s, { saleId: s.sales[0].id, lineId, qty: 1 });
  assert.equal(s.products[0].stock, 9);
  assert.equal(s.returns[0].creditedToDebt, 5000);
  assert.equal(s.returns[0].refunded, 5000);
  assert.equal(customerBalance(s, c.id), 0);
  assert.equal(metrics(s, ...far).margin, 4000);
  assert.throws(() => addReturn(s, { saleId: s.sales[0].id, lineId, qty: 2 }), /maximum : 1/);
});

test('inventaire, sorties et dépenses', () => {
  let s = shop();
  const b = s.products[0];
  s = addMovement(s, { productId: b.id, type: 'adjust', qty: 7, reason: 'Inventaire' });
  assert.equal(s.products[0].stock, 7);
  assert.throws(() => addMovement(s, { productId: b.id, type: 'out', qty: 8 }), /insuffisant/);
  s = addExpense(s, { category: 'Loyer', amount: 5000 });
  assert.equal(metrics(s, ...far).net, -5000);
});

test('un produit déjà vendu est archivé, pas supprimé', () => {
  let s = shop();
  s = addSale(s, { items: [{ productId: s.products[0].id, qty: 1 }], payment: 'cash' });
  s = deleteProduct(s, s.products[0].id);
  assert.equal(s.products[0].archived, true);
  s = deleteProduct(s, s.products[1].id);
  assert.equal(s.products.length, 1);
});

test('variantes : stock par taille, vente, retour et code-barres', () => {
  let s = emptyState();
  s = saveProduct(s, {
    name: 'Sandale', cost: 3000, price: 5000, barcode: '111',
    variants: [{ label: '38', stock: 2, barcode: '380' }, { label: '39', stock: 3 }],
  });
  const p = s.products[0], [v38, v39] = p.variants;
  assert.equal(p.stock, 5);
  assert.equal(findByCode(s, '380').variant.label, '38');
  assert.equal(findByCode(s, '111').variant, null);
  assert.throws(() => addSale(s, { items: [{ productId: p.id, qty: 1 }], payment: 'cash' }), /variante/);
  assert.throws(
    () => addSale(s, { items: [{ productId: p.id, variantId: v38.id, qty: 3 }], payment: 'cash' }),
    /Sandale \(38\)/);
  s = addSale(s, { items: [{ productId: p.id, variantId: v38.id, qty: 2 }], payment: 'cash' });
  assert.equal(s.sales[0].items[0].name, 'Sandale (38)');
  assert.deepEqual(s.products[0].variants.map((v) => v.stock), [0, 3]);
  s = addReturn(s, { saleId: s.sales[0].id, lineId: s.sales[0].items[0].id, qty: 1 });
  assert.deepEqual(s.products[0].variants.map((v) => v.stock), [1, 3]);
  assert.equal(s.products[0].stock, 4);
  // on ne retire pas une variante qui a du stock ; on peut en ajouter une
  assert.throws(() => saveProduct(s, { ...s.products[0], variants: [{ id: v38.id, label: '38' }] }), /encore du stock/);
  s = saveProduct(s, { ...s.products[0], variants: [...s.products[0].variants, { label: '40' }] });
  assert.equal(s.products[0].variants.length, 3);
  assert.equal(s.products[0].variants[1].id, v39.id);
});

test('achats fournisseurs : stock, coût moyen pondéré et dette', () => {
  let s = shop();
  s = saveSupplier(s, { name: 'Grossiste' });
  const sup = s.suppliers[0], b = s.products[0];
  s = addPurchase(s, { supplierId: sup.id, items: [{ productId: b.id, qty: 10, cost: 8000 }], paid: 30000 });
  assert.equal(s.products[0].stock, 20);
  assert.equal(s.products[0].cost, 7000);
  assert.equal(supplierBalance(s, sup.id), 50000);
  assert.throws(() => addSupplierPayment(s, { supplierId: sup.id, amount: 60000 }), /dépasse/);
  s = addSupplierPayment(s, { supplierId: sup.id, amount: 50000 });
  assert.equal(supplierBalance(s, sup.id), 0);
  assert.equal(metrics(s, ...far).purchases, 80000);
});

test('clôture de caisse : attendu, écart et fond de caisse reporté', () => {
  let s = shop();
  const [b, t] = s.products, c = s.customers[0];
  const at = (h) => new Date(2026, 10, 14, h);
  s = addSale(s, { items: [{ productId: b.id, qty: 1 }], payment: 'cash', date: at(9) });        // +10 000
  s = addSale(s, { items: [{ productId: t.id, qty: 1 }], payment: 'mobile', date: at(10) });      // hors caisse
  s = addSale(s, { items: [{ productId: t.id, qty: 1 }], payment: 'credit', customerId: c.id, paid: 1000, date: at(11) }); // +1 000
  s = addPayment(s, { customerId: c.id, amount: 500, method: 'cash', date: at(12) });             // +500
  s = addExpense(s, { category: 'Transport', amount: 2000, date: at(13) });                       // −2 000
  assert.equal(cashExpected(s, at(18)).expected, 9500);
  assert.throws(() => addClosing(s, { counted: '' }), /compté/);
  s = addClosing(s, { counted: 9000, kept: 3000, date: at(18) });
  assert.equal(s.closings[0].diff, -500);
  assert.equal(s.closings[0].withdrawn, 6000);
  s = addSale(s, { items: [{ productId: t.id, qty: 1 }], payment: 'cash', date: at(19) });
  assert.equal(cashExpected(s, at(20)).expected, 6000);
});

test('journal : une opération rejouée donne exactement le même état', () => {
  const base = shop();
  const op = {
    id: 'op-1', ts: '2026-11-14T10:00:00.000Z', user: 'Awa', action: 'addSale',
    payload: { items: [{ productId: base.products[0].id, qty: 1 }], payment: 'cash' },
  };
  const a = applyOp(base, op), b = applyOp(base, op);
  assert.deepEqual(a, b);
  assert.equal(a.sales[0].date, op.ts);
  assert.equal(a.sales[0].seller, 'Awa');
  // rejeu tolérant : la vente d'un autre appareil passe même si le stock local est épuisé
  const big = { ...op, id: 'op-2', payload: { items: [{ productId: base.products[0].id, qty: 50 }], payment: 'cash' } };
  assert.throws(() => applyOp(base, big), /insuffisant/);
  assert.equal(applyOp(base, big, { lenient: true }).products[0].stock, -40);
  assert.equal(actionName(addSale), 'addSale');
  assert.equal(canDo('seller', 'addSale'), true);
  assert.equal(canDo('seller', 'saveProduct'), false);
  assert.equal(canDo('owner', 'replaceAll'), true);
});

test('le nom de la boutique fixé à la création ne change jamais', () => {
  let s = shop();
  s = updateSettings(s, { currency: 'GNF', shopName: 'Autre nom' });
  assert.equal(s.settings.shopName, 'Chez Awa');
  assert.equal(s.settings.currency, 'GNF');
  s = replaceAll(s, { data: demoState(new Date(2026, 10, 14, 15)) });
  assert.equal(s.settings.shopName, 'Chez Awa');
  assert.ok(s.sales.length > 100);
});

test('périodes : semaine depuis lundi, mois depuis le 1er', () => {
  const now = new Date(2026, 10, 14, 15); // samedi 14 novembre 2026
  assert.equal(periodRange('week', now).start.getDate(), 9);
  assert.equal(periodRange('month', now).start.getDate(), 1);
  assert.equal(periodRange('month', now).prevStart.getMonth(), 9);
});

test('les données de démonstration sont cohérentes et produisent des conseils', () => {
  const now = new Date(2026, 10, 14, 15);
  const s = demoState(now);
  assert.ok(s.sales.length > 100);
  for (const p of s.products) {
    const sum = s.movements.filter((m) => m.productId === p.id).reduce((a, m) => a + m.qty, 0);
    assert.equal(sum, p.stock);
    assert.ok(p.stock >= 0);
    if (p.variants.length) assert.equal(p.variants.reduce((a, v) => a + v.stock, 0), p.stock);
  }
  assert.ok(s.products.some((p) => p.variants.length));
  const list = insights(s, (n) => `${n} F`, now);
  assert.ok(list.length >= 3);
});

// ---------- Plusieurs boutiques, rôles et rapports mensuels ----------
import { consolidate, previousMonthKey, monthBounds } from '../src/lib/overview.js';
import { buildEmails } from '../src/lib/monthly-email.js';

test('rôles : le gérant gère sa boutique mais ne peut pas en remplacer les données', () => {
  assert.equal(canDo('manager', 'saveProduct'), true);
  assert.equal(canDo('manager', 'addExpense'), true);
  assert.equal(canDo('manager', 'replaceAll'), false);
  assert.equal(canDo('seller', 'addExpense'), false);
  assert.equal(canDo(undefined, 'addSale'), false);
});

test('vue d\'ensemble : total et classement de plusieurs boutiques', () => {
  const day = new Date(2026, 9, 12, 10);
  const make = (name, qty) => {
    let s = emptyState(name);
    s = saveProduct(s, { name: 'Basket', cost: 6000, price: 10000, stock: 50, date: new Date(2026, 8, 1) });
    s = addSale(s, { items: [{ productId: s.products[0].id, qty }], payment: 'cash', date: day });
    return s;
  };
  let a = make('Centre', 3), b = make('Mokolo', 5);
  a = addExpense(a, { category: 'Loyer', amount: 8000, date: day });
  const c = consolidate([{ id: 'a', name: 'Centre', state: a }, { id: 'b', name: 'Mokolo', state: b }], '2026-10');
  assert.equal(c.total.m.revenue, 80000);
  assert.equal(c.total.m.margin, 32000);
  assert.equal(c.total.m.net, 24000);
  assert.deepEqual(c.ranking.map((r) => r.name), ['Mokolo', 'Centre']);
  assert.equal(consolidate([{ id: 'a', name: 'Centre', state: a }], '2026-09').total.m.revenue, 0);
  // devises différentes : pas de total
  const eur = { ...b, settings: { ...b.settings, currency: 'EUR' } };
  assert.equal(consolidate([{ id: 'a', name: 'A', state: a }, { id: 'b', name: 'B', state: eur }], '2026-10').total, null);
});

test('rapports par e-mail : un par gérant, un général par patron', () => {
  assert.equal(previousMonthKey(new Date(Date.UTC(2026, 10, 1, 6))), '2026-10');
  assert.equal(previousMonthKey(new Date(Date.UTC(2027, 0, 1, 6))), '2026-12');
  assert.equal(previousMonthKey(new Date(Date.UTC(2026, 9, 31, 23, 30)), 1), '2026-10'); // déjà novembre à Douala
  assert.equal(monthBounds('2026-10', 1).start.toISOString(), '2026-09-30T23:00:00.000Z');
  let s = emptyState('Centre');
  s = saveProduct(s, { name: 'Robe <luxe>', cost: 5000, price: 9000, stock: 10, date: new Date(Date.UTC(2026, 8, 1)) });
  s = addSale(s, { items: [{ productId: s.products[0].id, qty: 2 }], payment: 'cash', date: new Date(Date.UTC(2026, 9, 10)) });
  const shops = [
    { id: 's1', name: 'Centre', currency: 'FCFA', state: s, owners: ['boss@x.cm'], managers: ['g1@x.cm'] },
    { id: 's2', name: 'Mokolo', currency: 'FCFA', state: emptyState('Mokolo'), owners: ['boss@x.cm'], managers: [] },
  ];
  const emails = buildEmails(shops, '2026-10', 1);
  assert.deepEqual(emails.map((e) => [e.to, e.scope]), [['g1@x.cm', 's1'], ['boss@x.cm', 'general']]);
  assert.match(emails[0].subject, /Centre — rapport de octobre 2026/);
  assert.match(emails[1].subject, /Rapport général.*2 boutiques/);
  assert.match(emails[1].html, /Ensemble des boutiques/);
  assert.match(emails[1].html, /18\s000 FCFA/);
  assert.match(emails[0].html, /Robe &lt;luxe&gt;/);
  assert.doesNotMatch(emails[0].html, /Mokolo/);
});

// ---------- Mode caisse : vente au poids, monnaie rendue, étiquettes de balance ----------
import { fmtQty } from '../src/lib/logic.js';

test('vente au poids : quantités décimales, arrondis et étiquette de balance', () => {
  let s = emptyState();
  s = saveProduct(s, { name: 'Farine', code: '12345', unit: 'kg', cost: 400, price: 650, stock: 25 });
  s = saveProduct(s, { name: 'Pain', cost: 100, price: 150, stock: 40 });
  const [farine, pain] = s.products;
  assert.throws(() => addSale(s, { items: [{ productId: pain.id, qty: 1.5 }], payment: 'cash' }), /entière/);
  assert.throws(() => saveProduct(s, { name: 'X', unit: 'kg', variants: [{ label: 'A' }] }), /variantes/);
  s = addSale(s, { items: [{ productId: farine.id, qty: 0.1 }, { productId: farine.id, qty: 0.2 }], payment: 'cash', received: 500 });
  assert.equal(s.products[0].stock, 24.7); // pas d'erreur d'arrondi 0,1 + 0,2
  assert.equal(s.sales[0].total, 195);
  assert.equal(s.sales[0].change, 305);
  assert.equal(s.sales[0].items[0].unit, 'kg');
  assert.equal(fmtQty(1.25, 'kg'), '1,25 kg');
  assert.equal(fmtQty(3, 'unit'), '3');
  // étiquette de balance : 21 + article 12345 + 01250 g + clé
  const hit = findByCode(s, '2112345012507');
  assert.equal(hit.product.name, 'Farine');
  assert.equal(hit.qty, 1.25);
  assert.equal(findByCode(s, '2199999012507'), null);
  // monnaie : ignorée si le montant reçu est insuffisant ou si le paiement n'est pas en espèces
  s = addSale(s, { items: [{ productId: pain.id, qty: 2 }], payment: 'mobile', received: 1000 });
  assert.equal(s.sales[1].change, null);
});

// ---------- Plusieurs caisses dans une même boutique ----------
import { registersOf } from '../src/lib/logic.js';

test('plusieurs caisses : numérotation et clôture séparées par caisse', () => {
  let s = shop();
  const b = s.products[0];
  const at = (h) => new Date(2026, 10, 14, h).toISOString();
  const op = (id, register, action, payload, h) => ({ id, ts: at(h), user: 'x', register, action, payload });
  const sale = (qty) => ({ items: [{ productId: b.id, qty }], payment: 'cash' });
  s = applyOp(s, op('o1', 'Caisse 1', 'addSale', sale(1), 9));
  s = applyOp(s, op('o2', 'Caisse 2', 'addSale', sale(2), 10));
  s = applyOp(s, op('o3', 'Caisse 1', 'addSale', sale(1), 11));
  assert.deepEqual(s.sales.map((x) => x.number.slice(8)), ['CAISSE1-00001', 'CAISSE2-00001', 'CAISSE1-00002']);
  assert.deepEqual(registersOf(s), ['Caisse 1', 'Caisse 2']);
  assert.equal(cashExpected(s, at(12), 'Caisse 1').expected, 20000);
  assert.equal(cashExpected(s, at(12), 'Caisse 2').expected, 20000);
  // une dépense payée sur la caisse 2 ne touche pas la caisse 1
  s = applyOp(s, op('o4', 'Caisse 2', 'addExpense', { category: 'Transport', amount: 3000 }, 12));
  assert.equal(cashExpected(s, at(13), 'Caisse 2').expected, 17000);
  // clôture de la caisse 1 : la caisse 2 reste ouverte avec ses espèces
  s = applyOp(s, op('o5', 'Caisse 1', 'addClosing', { counted: 19000, kept: 5000 }, 18));
  assert.equal(s.closings[0].register, 'Caisse 1');
  assert.equal(s.closings[0].diff, -1000);
  assert.equal(cashExpected(s, at(19), 'Caisse 1').expected, 5000);
  assert.equal(cashExpected(s, at(19), 'Caisse 2').expected, 17000);
  // sans nom de caisse, l'ancienne numérotation continue
  s = applyOp(s, op('o6', '', 'addSale', sale(1), 20));
  assert.match(s.sales.at(-1).number, /^FA-2026-00001$/);
});

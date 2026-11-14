import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, saveProduct, addMovement, addSale, addReturn, addExpense, saveCustomer,
  addPayment, customerBalance, metrics, topProducts, periodRange, lowStock, deleteProduct,
} from '../src/lib/logic.js';
import { insights } from '../src/lib/insights.js';
import { demoState } from '../src/lib/demo.js';

const far = [new Date(2000, 0, 1), new Date(2100, 0, 1)];

function shop() {
  let s = emptyState();
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

test('une vente diminue le stock et calcule marge et remise', () => {
  let s = shop();
  const [b, t] = s.products;
  s = addSale(s, {
    items: [{ productId: b.id, qty: 2 }, { productId: t.id, qty: 1 }], discount: 1000, payment: 'cash',
  });
  assert.equal(s.products[0].stock, 8);
  assert.equal(s.sales[0].total, 22000);
  const m = metrics(s, ...far);
  assert.equal(m.revenue, 22000);
  assert.equal(m.cogs, 14000);
  assert.equal(m.margin, 8000);
  assert.equal(m.cashIn, 22000);
  assert.equal(topProducts(s, ...far)[0].name, 'Basket');
});

test('vente refusée si stock insuffisant, sans modifier l\'état', () => {
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
  assert.equal(metrics(s, ...far).cashIn, 4000);
  assert.throws(() => addPayment(s, { customerId: c.id, amount: 7000 }), /dépasse/);
  s = addPayment(s, { customerId: c.id, amount: 2500, method: 'mobile' });
  assert.equal(customerBalance(s, c.id), 3500);
  assert.equal(metrics(s, ...far).cashIn, 6500);
});

test('un retour remet en stock et réduit d\'abord la dette', () => {
  let s = shop();
  const c = s.customers[0], b = s.products[0];
  s = addSale(s, { items: [{ productId: b.id, qty: 2 }], payment: 'credit', customerId: c.id, paid: 15000 });
  s = addReturn(s, { saleId: s.sales[0].id, productId: b.id, qty: 1 });
  assert.equal(s.products[0].stock, 9);
  assert.equal(s.returns[0].creditedToDebt, 5000);
  assert.equal(s.returns[0].refunded, 5000);
  assert.equal(customerBalance(s, c.id), 0);
  const m = metrics(s, ...far);
  assert.equal(m.revenue, 10000);
  assert.equal(m.margin, 4000);
  assert.equal(m.cashIn, 10000);
  assert.throws(() => addReturn(s, { saleId: s.sales[0].id, productId: b.id, qty: 2 }), /maximum : 1/);
});

test('inventaire, sorties et dépenses', () => {
  let s = shop();
  const b = s.products[0];
  s = addMovement(s, { productId: b.id, type: 'adjust', qty: 7, reason: 'Inventaire' });
  assert.equal(s.products[0].stock, 7);
  assert.equal(s.movements.at(-1).qty, -3);
  assert.throws(() => addMovement(s, { productId: b.id, type: 'out', qty: 8 }), /insuffisant/);
  s = addExpense(s, { category: 'Loyer', amount: 5000 });
  const m = metrics(s, ...far);
  assert.equal(m.expenses, 5000);
  assert.equal(m.net, -5000);
});

test('un produit déjà vendu est archivé, pas supprimé', () => {
  let s = shop();
  s = addSale(s, { items: [{ productId: s.products[0].id, qty: 1 }], payment: 'cash' });
  s = deleteProduct(s, s.products[0].id);
  assert.equal(s.products[0].archived, true);
  s = deleteProduct(s, s.products[1].id);
  assert.equal(s.products.length, 1);
});

test('périodes : semaine depuis lundi, mois depuis le 1er', () => {
  const now = new Date(2026, 10, 14, 15); // samedi 14 novembre 2026
  assert.equal(periodRange('week', now).start.getDate(), 9);
  assert.equal(periodRange('month', now).start.getDate(), 1);
  assert.equal(periodRange('month', now).prevStart.getMonth(), 9);
  assert.equal(periodRange('day', now).prevStart.getDate(), 13);
});

test('les données de démonstration sont cohérentes et produisent des conseils', () => {
  const now = new Date(2026, 10, 14, 15);
  const s = demoState(now);
  assert.ok(s.sales.length > 100);
  for (const p of s.products) {
    const sum = s.movements.filter((m) => m.productId === p.id).reduce((a, m) => a + m.qty, 0);
    assert.equal(sum, p.stock);
    assert.ok(p.stock >= 0);
  }
  const list = insights(s, (n) => `${n} F`, now);
  assert.ok(list.length >= 3);
  assert.ok(list.every((i) => i.title && i.text && i.level));
});

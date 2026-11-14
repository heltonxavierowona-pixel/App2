import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Tabs, Empty, Modal, Field, fmtDateTime, whatsappLink } from '../ui.jsx';
import { addSale, addReturn, returnedQty, saveCustomer, PAYMENTS } from '../lib/logic.js';

function receiptText(sale, state, fmt) {
  const lines = sale.items.map((i) => `${i.qty} x ${i.name} : ${fmt(i.qty * i.price)}`);
  if (sale.discount) lines.push(`Remise : -${fmt(sale.discount)}`);
  lines.push(`TOTAL : ${fmt(sale.total)}`, `Paiement : ${PAYMENTS[sale.payment]}`);
  if (sale.total > sale.paid) lines.push(`Versé : ${fmt(sale.paid)} — Reste : ${fmt(sale.total - sale.paid)}`);
  return `${state.settings.shopName}\nReçu du ${fmtDateTime(sale.date)}\n\n${lines.join('\n')}\n\nMerci pour votre achat !`;
}

function NewSale() {
  const { state, run, fmt, setState, notify } = useStore();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]); // { productId, qty, price }
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [paid, setPaid] = useState('');
  const [newCustomer, setNewCustomer] = useState('');

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products
      .filter((p) => !p.archived)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
        || p.category.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.products, query]);

  const byId = (id) => state.products.find((p) => p.id === id);
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const add = (p) => {
    const line = cart.find((l) => l.productId === p.id);
    const qty = (line?.qty ?? 0) + 1;
    if (qty > p.stock) return notify(`Stock insuffisant pour « ${p.name} » (disponible : ${p.stock}).`, 'error');
    setCart(line
      ? cart.map((l) => (l.productId === p.id ? { ...l, qty } : l))
      : [...cart, { productId: p.id, qty: 1, price: p.price }]);
  };
  const setLine = (id, patch) =>
    setCart(cart.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  const createCustomer = () => {
    try {
      const next = saveCustomer(state, { name: newCustomer });
      setState(next);
      setCustomerId(next.customers.at(-1).id);
      setNewCustomer('');
    } catch (e) { notify(e.message, 'error'); }
  };

  const submit = () => {
    const ok = run(addSale, { items: cart, discount, payment, customerId, paid }, `Vente enregistrée : ${fmt(total)}`);
    if (ok) { setCart([]); setDiscount(''); setPaid(''); setPayment('cash'); setCustomerId(''); }
  };

  if (!state.products.some((p) => !p.archived))
    return <div className="card"><Empty icon="box" title="Aucun produit">Ajoutez d'abord des produits dans le catalogue pour pouvoir vendre.</Empty></div>;

  return (
    <div className="pos-grid">
      <section className="card">
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder="Chercher un produit (nom, code, catégorie)…" value={query}
            onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="tiles">
          {products.map((p) => (
            <button key={p.id} className="tile" disabled={p.stock <= 0} onClick={() => add(p)}>
              <span className="tile-name">{p.name}</span>
              <span className="tile-price">{fmt(p.price)}</span>
              <span className={`tile-stock${p.stock <= p.minStock ? ' low' : ''}`}>
                {p.stock <= 0 ? 'Rupture' : `Stock : ${p.stock}`}
              </span>
            </button>
          ))}
          {!products.length && <p className="muted">Aucun produit ne correspond.</p>}
        </div>
      </section>

      <section className="card cart">
        <h3>Panier</h3>
        {!cart.length && <p className="muted">Touchez un produit pour l'ajouter.</p>}
        {cart.map((l) => {
          const p = byId(l.productId);
          return (
            <div key={l.productId} className="cart-line">
              <div className="cart-name">{p.name}</div>
              <div className="qty">
                <button onClick={() => (l.qty > 1 ? setLine(l.productId, { qty: l.qty - 1 }) : setCart(cart.filter((x) => x !== l)))} aria-label="Moins">−</button>
                <span>{l.qty}</span>
                <button onClick={() => add(p)} aria-label="Plus">+</button>
              </div>
              <input className="price-input" type="number" min="0" inputMode="numeric" value={l.price}
                aria-label="Prix unitaire" onChange={(e) => setLine(l.productId, { price: Number(e.target.value) })} />
              <div className="num">{fmt(l.qty * l.price)}</div>
            </div>
          );
        })}

        {cart.length > 0 && (
          <>
            <div className="form-grid">
              <Field label="Remise">
                <input type="number" min="0" inputMode="numeric" value={discount} placeholder="0"
                  onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <Field label="Paiement">
                <select value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {Object.entries(PAYMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <Field label={payment === 'credit' ? 'Client (obligatoire)' : 'Client (facultatif)'}>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Aucun —</option>
                {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="row">
              <input placeholder="Nouveau client…" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} />
              <button className="btn" disabled={!newCustomer.trim()} onClick={createCustomer}>Créer</button>
            </div>
            {payment === 'credit' && (
              <Field label="Montant versé maintenant" hint={`Reste dû : ${fmt(Math.max(0, total - (Number(paid) || 0)))}`}>
                <input type="number" min="0" inputMode="numeric" value={paid} placeholder="0"
                  onChange={(e) => setPaid(e.target.value)} />
              </Field>
            )}
            <div className="total"><span>Total</span><strong>{fmt(total)}</strong></div>
            <button className="btn primary big" onClick={submit}><Icon name="check" size={18} /> Valider la vente</button>
          </>
        )}
      </section>
    </div>
  );
}

function History() {
  const { state, run, fmt } = useStore();
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(40);
  const sales = useMemo(() => [...state.sales].sort((a, b) => b.date.localeCompare(a.date)), [state.sales]);
  const sale = open && state.sales.find((s) => s.id === open);
  const customer = (id) => state.customers.find((c) => c.id === id);

  if (!sales.length)
    return <div className="card"><Empty icon="cart" title="Aucune vente">Vos ventes apparaîtront ici.</Empty></div>;

  return (
    <section className="card">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Articles</th><th>Paiement</th><th className="r">Total</th></tr></thead>
          <tbody>
            {sales.slice(0, limit).map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setOpen(s.id)}>
                <td>{fmtDateTime(s.date)}</td>
                <td>{s.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}
                  {state.returns.some((r) => r.saleId === s.id) && <span className="badge warn">retour</span>}</td>
                <td>{PAYMENTS[s.payment]}{s.customerId && ` · ${customer(s.customerId)?.name ?? ''}`}</td>
                <td className="r num">{fmt(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sales.length > limit && <button className="link" onClick={() => setLimit(limit + 40)}>Afficher plus…</button>}

      {sale && (
        <Modal title={`Vente du ${fmtDateTime(sale.date)}`} onClose={() => setOpen(null)}>
          <ul className="plain">
            {sale.items.map((i) => {
              const back = returnedQty(state, sale.id, i.productId);
              const left = i.qty - back;
              return (
                <li key={i.productId} className="return-line">
                  <div>
                    <strong>{i.qty} × {i.name}</strong>
                    <div className="muted">{fmt(i.price)} l'unité{back > 0 && ` · ${back} retourné(s)`}</div>
                  </div>
                  {left > 0 && (
                    <button className="btn small" onClick={() =>
                      window.confirm(`Enregistrer le retour d'un « ${i.name} » ? Il sera remis en stock.`) &&
                      run(addReturn, { saleId: sale.id, productId: i.productId, qty: 1 }, 'Retour enregistré')}>
                      Retour ×1
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <hr />
          <ul className="plain">
            {sale.discount > 0 && <li className="rank-line"><span>Remise</span><span className="num">−{fmt(sale.discount)}</span></li>}
            <li className="rank-line"><strong>Total</strong><strong className="num">{fmt(sale.total)}</strong></li>
            <li className="rank-line"><span>Paiement</span><span>{PAYMENTS[sale.payment]}</span></li>
            {sale.total > sale.paid && <li className="rank-line"><span>Versé à la vente</span><span className="num">{fmt(sale.paid)}</span></li>}
            {sale.customerId && <li className="rank-line"><span>Client</span><span>{customer(sale.customerId)?.name}</span></li>}
          </ul>
          <a className="btn" target="_blank" rel="noreferrer"
            href={whatsappLink(customer(sale.customerId)?.phone, receiptText(sale, state, fmt))}>
            <Icon name="send" size={16} /> Envoyer le reçu par WhatsApp
          </a>
        </Modal>
      )}
    </section>
  );
}

export default function Sales() {
  const [tab, setTab] = useState('new');
  return (
    <>
      <PageHead title="Ventes" sub="Enregistrez une vente ou consultez l'historique et les retours" />
      <Tabs value={tab} onChange={setTab} options={[['new', 'Nouvelle vente'], ['history', 'Historique & retours']]} />
      {tab === 'new' ? <NewSale /> : <History />}
    </>
  );
}

import React, { useCallback, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Tabs, Empty, Modal, Field, fmtDateTime, whatsappLink } from '../ui.jsx';
import {
  addSale, addReturn, returnedQty, saveCustomer, PAYMENTS, hasVariants, lineName, findByCode,
} from '../lib/logic.js';
import Scanner from '../components/Scanner.jsx';
import Invoice from '../components/Invoice.jsx';

function receiptText(sale, state, fmt) {
  const lines = sale.items.map((i) => `${i.qty} x ${i.name} : ${fmt(i.qty * i.price)}`);
  if (sale.discount) lines.push(`Remise : -${fmt(sale.discount)}`);
  lines.push(`TOTAL : ${fmt(sale.total)}`, `Paiement : ${PAYMENTS[sale.payment]}`);
  if (sale.total > sale.paid) lines.push(`Versé : ${fmt(sale.paid)} — Reste : ${fmt(sale.total - sale.paid)}`);
  return `${state.settings.shopName}\nFacture ${sale.number} du ${fmtDateTime(sale.date)}\n\n${lines.join('\n')}\n\nMerci pour votre achat !`;
}

const keyOf = (productId, variantId) => `${productId}|${variantId ?? ''}`;

function NewSale() {
  const { state, run, fmt, notify, print } = useStore();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]); // { productId, variantId, qty, price }
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [paid, setPaid] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [choosing, setChoosing] = useState(null); // produit dont on choisit la variante
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState(null); // dernière vente validée

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products
      .filter((p) => !p.archived)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
        || p.category.toLowerCase().includes(q) || p.barcode === q)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.products, query]);

  const resolve = (l) => {
    const product = state.products.find((p) => p.id === l.productId);
    const variant = product?.variants?.find((v) => v.id === l.variantId) ?? null;
    return { product, variant, available: variant ? variant.stock : product?.stock ?? 0 };
  };
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const add = useCallback((product, variant = null) => {
    if (hasVariants(product) && !variant) { setChoosing(product); return; }
    setChoosing(null);
    setLast(null);
    setCart((current) => {
      const key = keyOf(product.id, variant?.id);
      const line = current.find((l) => keyOf(l.productId, l.variantId) === key);
      const qty = (line?.qty ?? 0) + 1;
      const available = variant ? variant.stock : product.stock;
      if (qty > available) {
        notify(`Stock insuffisant pour « ${lineName(product, variant)} » (disponible : ${available}).`, 'error');
        return current;
      }
      return line
        ? current.map((l) => (l === line ? { ...l, qty } : l))
        : [...current, { productId: product.id, variantId: variant?.id ?? null, qty: 1, price: product.price }];
    });
  }, [notify]);

  const setLine = (line, patch) => setCart(cart.map((l) => (l === line ? { ...l, ...patch } : l)));

  const onScan = useCallback((code) => {
    setScanning(false);
    const hit = findByCode(state, code);
    if (!hit) return notify(`Aucun produit avec le code ${code}.`, 'error');
    add(hit.product, hit.variant);
    return undefined;
  }, [state, add, notify]);

  const createCustomer = () => {
    const next = run(saveCustomer, { name: newCustomer });
    if (next) { setCustomerId(next.customers.at(-1).id); setNewCustomer(''); }
  };

  const submit = () => {
    const next = run(addSale, { items: cart, discount, payment, customerId, paid }, `Vente enregistrée : ${fmt(total)}`);
    if (next) {
      setLast(next.sales.at(-1));
      setCart([]); setDiscount(''); setPaid(''); setPayment('cash'); setCustomerId('');
    }
  };

  if (!state.products.some((p) => !p.archived))
    return <div className="card"><Empty icon="box" title="Aucun produit">Ajoutez d'abord des produits dans le catalogue pour pouvoir vendre.</Empty></div>;

  return (
    <div className="pos-grid">
      <section className="card">
        <div className="row">
          <div className="search">
            <Icon name="search" size={16} />
            <input placeholder="Chercher un produit (nom, code, catégorie)…" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className="btn" onClick={() => setScanning(true)}><Icon name="scan" size={16} /> Scanner</button>
        </div>
        <div className="tiles">
          {products.map((p) => (
            <button key={p.id} className="tile" disabled={p.stock <= 0} onClick={() => add(p)}>
              <span className="tile-name">{p.name}</span>
              <span className="tile-price">{fmt(p.price)}</span>
              <span className={`tile-stock${p.stock <= p.minStock ? ' low' : ''}`}>
                {p.stock <= 0 ? 'Rupture' : `Stock : ${p.stock}`}{hasVariants(p) && ` · ${p.variants.length} variantes`}
              </span>
            </button>
          ))}
          {!products.length && <p className="muted">Aucun produit ne correspond.</p>}
        </div>
      </section>

      <section className="card cart">
        <h3>Panier</h3>
        {!cart.length && !last && <p className="muted">Touchez un produit ou scannez son code-barres pour l'ajouter.</p>}
        {!cart.length && last && (
          <div className="note good">
            <strong>Vente {last.number} enregistrée — {fmt(last.total)}</strong>
            <div className="row">
              <button className="btn" onClick={() => print(<Invoice sale={last} state={state} fmt={fmt} />)}>
                <Icon name="print" size={16} /> Imprimer la facture
              </button>
              <a className="btn" target="_blank" rel="noreferrer"
                href={whatsappLink(state.customers.find((c) => c.id === last.customerId)?.phone, receiptText(last, state, fmt))}>
                <Icon name="send" size={16} /> WhatsApp
              </a>
            </div>
          </div>
        )}
        {cart.map((l) => {
          const { product, variant, available } = resolve(l);
          return (
            <div key={keyOf(l.productId, l.variantId)} className="cart-line">
              <div className="cart-name">{lineName(product, variant)}</div>
              <div className="qty">
                <button onClick={() => (l.qty > 1 ? setLine(l, { qty: l.qty - 1 }) : setCart(cart.filter((x) => x !== l)))} aria-label="Moins">−</button>
                <span>{l.qty}</span>
                <button onClick={() => (l.qty < available ? setLine(l, { qty: l.qty + 1 })
                  : notify(`Stock insuffisant (disponible : ${available}).`, 'error'))} aria-label="Plus">+</button>
              </div>
              <input className="price-input" type="number" min="0" inputMode="numeric" value={l.price}
                aria-label="Prix unitaire" onChange={(e) => setLine(l, { price: Number(e.target.value) })} />
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

      {choosing && (
        <Modal title={choosing.name} onClose={() => setChoosing(null)}>
          <p className="muted">Choisissez la variante vendue.</p>
          <div className="tiles">
            {choosing.variants.map((v) => (
              <button key={v.id} className="tile" disabled={v.stock <= 0} onClick={() => add(choosing, v)}>
                <span className="tile-name">{v.label}</span>
                <span className={`tile-stock${v.stock <= 0 ? ' low' : ''}`}>{v.stock <= 0 ? 'Rupture' : `Stock : ${v.stock}`}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {scanning && <Scanner onDetect={onScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

function History() {
  const { state, run, fmt, print } = useStore();
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
          <thead><tr><th>Facture</th><th>Articles</th><th>Paiement</th><th className="r">Total</th></tr></thead>
          <tbody>
            {sales.slice(0, limit).map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setOpen(s.id)}>
                <td><strong>{s.number}</strong><div className="muted">{fmtDateTime(s.date)}{s.seller && ` · ${s.seller}`}</div></td>
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
        <Modal title={`Facture ${sale.number}`} onClose={() => setOpen(null)}>
          <p className="muted">{fmtDateTime(sale.date)}{sale.seller && ` · vendu par ${sale.seller}`}</p>
          <ul className="plain">
            {sale.items.map((i) => {
              const back = returnedQty(state, sale.id, i.id);
              const left = i.qty - back;
              return (
                <li key={i.id} className="return-line">
                  <div>
                    <strong>{i.qty} × {i.name}</strong>
                    <div className="muted">{fmt(i.price)} l'unité{back > 0 && ` · ${back} retourné(s)`}</div>
                  </div>
                  {left > 0 && (
                    <button className="btn small" onClick={() =>
                      window.confirm(`Enregistrer le retour d'un « ${i.name} » ? Il sera remis en stock.`) &&
                      run(addReturn, { saleId: sale.id, lineId: i.id, qty: 1 }, 'Retour enregistré')}>
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
          <div className="row">
            <button className="btn primary" onClick={() => print(<Invoice sale={sale} state={state} fmt={fmt} />)}>
              <Icon name="print" size={16} /> Imprimer / PDF
            </button>
            <a className="btn" target="_blank" rel="noreferrer"
              href={whatsappLink(customer(sale.customerId)?.phone, receiptText(sale, state, fmt))}>
              <Icon name="send" size={16} /> WhatsApp
            </a>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default function Sales() {
  const [tab, setTab] = useState('new');
  return (
    <>
      <PageHead title="Ventes" sub="Enregistrez une vente, imprimez la facture, gérez les retours" />
      <Tabs value={tab} onChange={setTab} options={[['new', 'Nouvelle vente'], ['history', 'Factures & retours']]} />
      {tab === 'new' ? <NewSale /> : <History />}
    </>
  );
}

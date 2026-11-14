import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Tabs, Empty, Modal, Field, fmtDateTime, whatsappLink } from '../ui.jsx';
import {
  addSale, addReturn, returnedQty, saveCustomer, PAYMENTS, hasVariants, lineName, findByCode,
  isMeasured, UNITS, fmtQty,
} from '../lib/logic.js';
import { usePrefs } from '../lib/prefs.js';
import Ticket, { saleDocument } from '../components/Ticket.jsx';
import Scanner from '../components/Scanner.jsx';
import Invoice from '../components/Invoice.jsx';

function receiptText(sale, state, fmt) {
  const lines = sale.items.map((i) => `${fmtQty(i.qty, i.unit)} x ${i.name} : ${fmt(Math.round(i.qty * i.price))}`);
  if (sale.discount) lines.push(`Remise : -${fmt(sale.discount)}`);
  lines.push(`TOTAL : ${fmt(sale.total)}`, `Paiement : ${PAYMENTS[sale.payment]}`);
  if (sale.total > sale.paid) lines.push(`Versé : ${fmt(sale.paid)} — Reste : ${fmt(sale.total - sale.paid)}`);
  return `${state.settings.shopName}\nFacture ${sale.number} du ${fmtDateTime(sale.date)}\n\n${lines.join('\n')}\n\nMerci pour votre achat !`;
}

const keyOf = (productId, variantId) => `${productId}|${variantId ?? ''}`;
const PAY_ORDER = Object.keys(PAYMENTS);
const MAX_TILES = 60;

function NewSale() {
  const { state, run, fmt, notify, print } = useStore();
  const [prefs] = usePrefs();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]); // { productId, variantId, qty, price }
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [paid, setPaid] = useState('');
  const [received, setReceived] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [choosing, setChoosing] = useState(null); // produit dont on choisit la variante
  const [weighing, setWeighing] = useState(null); // produit vendu au poids : saisie de la quantité
  const [weight, setWeight] = useState('');
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState(null); // dernière vente validée
  const searchRef = useRef(null);

  // Les produits les plus vendus d'abord : sur un grand catalogue, ils restent à portée de main.
  const popularity = useMemo(() => {
    const count = new Map();
    for (const sale of state.sales.slice(-2000))
      for (const i of sale.items) count.set(i.productId, (count.get(i.productId) ?? 0) + 1);
    return count;
  }, [state.sales]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products
      .filter((p) => !p.archived)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
        || p.category.toLowerCase().includes(q) || p.barcode === q)
      .sort((a, b) => (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [state.products, query, popularity]);
  const products = matches.slice(0, MAX_TILES);

  const resolve = (l) => {
    const product = state.products.find((p) => p.id === l.productId);
    const variant = product?.variants?.find((v) => v.id === l.variantId) ?? null;
    return { product, variant, available: variant ? variant.stock : product?.stock ?? 0 };
  };
  const subtotal = Math.round(cart.reduce((s, l) => s + l.qty * l.price, 0));
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const change = payment === 'cash' && received !== '' ? Number(received) - total : null;

  // Ajoute `qty` au panier (1 par défaut). Les produits au poids passent par la saisie de la quantité.
  const add = useCallback((product, variant = null, qty = null) => {
    if (hasVariants(product) && !variant) { setChoosing(product); return; }
    if (isMeasured(product) && qty == null) { setWeighing(product); setWeight(''); return; }
    setChoosing(null);
    setWeighing(null);
    setLast(null);
    setCart((current) => {
      const key = keyOf(product.id, variant?.id);
      const line = current.find((l) => keyOf(l.productId, l.variantId) === key);
      const next = Math.round(((line?.qty ?? 0) + (qty ?? 1)) * 1000) / 1000;
      const available = variant ? variant.stock : product.stock;
      if (next > available) {
        notify(`Stock insuffisant pour « ${lineName(product, variant)} » (disponible : ${fmtQty(available, product.unit)}).`, 'error');
        return current;
      }
      return line
        ? current.map((l) => (l === line ? { ...l, qty: next } : l))
        : [...current, { productId: product.id, variantId: variant?.id ?? null, qty: next, price: product.price }];
    });
  }, [notify]);

  const setLine = (line, patch) => setCart(cart.map((l) => (l === line ? { ...l, ...patch } : l)));

  // Code lu par la douchette, la caméra ou saisi : ajoute directement l'article au panier.
  const onScan = useCallback((code) => {
    setScanning(false);
    const hit = findByCode(state, code);
    if (!hit) { notify(`Aucun produit avec le code ${code}.`, 'error'); return false; }
    add(hit.product, hit.variant, hit.qty ?? null);
    return true;
  }, [state, add, notify]);

  const createCustomer = () => {
    const next = run(saveCustomer, { name: newCustomer });
    if (next) { setCustomerId(next.customers.at(-1).id); setNewCustomer(''); }
  };

  const submit = useCallback(() => {
    if (!cart.length) return;
    if (change != null && change < 0) { notify(`Il manque ${fmt(-change)} sur le montant reçu.`, 'error'); return; }
    const next = run(addSale, { items: cart, discount, payment, customerId, paid, received },
      `Vente enregistrée : ${fmt(total)}${change > 0 ? ` — rendre ${fmt(change)}` : ''}`);
    if (next) {
      const sale = next.sales.at(-1);
      setLast(sale);
      setCart([]); setDiscount(''); setPaid(''); setReceived(''); setPayment('cash'); setCustomerId('');
      if (prefs.autoPrint) print(saleDocument(prefs.printFormat, { sale, state: next, fmt }));
      searchRef.current?.focus();
    }
  }, [cart, change, discount, payment, customerId, paid, received, total, run, fmt, notify, prefs, print]);

  // Raccourcis clavier et douchette : une douchette « tape » le code très vite puis Entrée.
  const scanBuffer = useRef({ text: '', at: 0 });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
      if (e.key === 'F4') { e.preventDefault(); submit(); return; }
      if (e.key === 'F8') { e.preventDefault(); setPayment((p) => PAY_ORDER[(PAY_ORDER.indexOf(p) + 1) % PAY_ORDER.length]); return; }
      if (e.target.closest?.('input, select, textarea, [role="dialog"]')) return;
      const buffer = scanBuffer.current;
      const now = Date.now();
      if (now - buffer.at > 300) buffer.text = '';
      buffer.at = now;
      if (e.key === 'Enter') {
        if (buffer.text.length >= 3) { e.preventDefault(); onScan(buffer.text); }
        buffer.text = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) buffer.text += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, onScan]);

  // Entrée dans la recherche : code-barres exact, sinon l'unique produit trouvé.
  const onSearchKey = (e) => {
    if (e.key === 'Escape') { setQuery(''); return; }
    if (e.key !== 'Enter' || !query.trim()) return;
    e.preventDefault();
    const hit = findByCode(state, query.trim());
    if (hit) { add(hit.product, hit.variant, hit.qty ?? null); setQuery(''); }
    else if (matches.length === 1) { add(matches[0]); setQuery(''); }
    else if (!matches.length) notify(`Aucun produit pour « ${query.trim()} ».`, 'error');
  };

  if (!state.products.some((p) => !p.archived))
    return <div className="card"><Empty icon="box" title="Aucun produit">Ajoutez d'abord des produits dans le catalogue pour pouvoir vendre.</Empty></div>;

  return (
    <div className="pos-grid">
      <section className="card">
        <div className="row">
          <div className="search">
            <Icon name="search" size={16} />
            <input ref={searchRef} placeholder="Scanner ou chercher un produit (nom, code)…" value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} aria-label="Scanner ou chercher un produit" />
          </div>
          <button className="btn" onClick={() => setScanning(true)}><Icon name="scan" size={16} /> Caméra</button>
        </div>
        <div className="tiles">
          {products.map((p) => (
            <button key={p.id} className="tile" disabled={p.stock <= 0} onClick={() => add(p)}>
              <span className="tile-name">{p.name}</span>
              <span className="tile-price">{fmt(p.price)}{isMeasured(p) && ` / ${UNITS[p.unit]}`}</span>
              <span className={`tile-stock${p.stock <= p.minStock ? ' low' : ''}`}>
                {p.stock <= 0 ? 'Rupture' : `Stock : ${fmtQty(p.stock, p.unit)}`}{hasVariants(p) && ` · ${p.variants.length} variantes`}
              </span>
            </button>
          ))}
          {!products.length && <p className="muted">Aucun produit ne correspond.</p>}
        </div>
        {matches.length > MAX_TILES && (
          <p className="muted small">{matches.length} produits : les {MAX_TILES} plus vendus sont affichés. Scannez ou tapez un nom pour trouver les autres.</p>
        )}
        <p className="keys muted small"><kbd>F2</kbd> chercher · <kbd>Entrée</kbd> ajouter · <kbd>F8</kbd> mode de paiement · <kbd>F4</kbd> valider</p>
      </section>

      <section className="card cart">
        <h3>Panier</h3>
        {!cart.length && !last && <p className="muted">Scannez un article ou cliquez sur un produit pour l'ajouter.</p>}
        {!cart.length && last && (
          <div className="note good">
            <strong>Vente {last.number} enregistrée — {fmt(last.total)}</strong>
            {last.change > 0 && <p className="change">Monnaie à rendre : <strong>{fmt(last.change)}</strong></p>}
            <div className="row">
              <button className="btn primary" onClick={() => print(<Ticket sale={last} state={state} fmt={fmt} />)}>
                <Icon name="print" size={16} /> Ticket
              </button>
              <button className="btn" onClick={() => print(<Invoice sale={last} state={state} fmt={fmt} />)}>Facture A4</button>
              <a className="btn" target="_blank" rel="noreferrer"
                href={whatsappLink(state.customers.find((c) => c.id === last.customerId)?.phone, receiptText(last, state, fmt))}>
                <Icon name="send" size={16} /> WhatsApp
              </a>
            </div>
          </div>
        )}
        {cart.map((l) => {
          const { product, variant, available } = resolve(l);
          const measured = isMeasured(product);
          return (
            <div key={keyOf(l.productId, l.variantId)} className="cart-line">
              <div className="cart-name">{lineName(product, variant)}
                <button className="icon-btn" aria-label={`Retirer ${product.name}`} onClick={() => setCart(cart.filter((x) => x !== l))}><Icon name="x" size={15} /></button>
              </div>
              {measured ? (
                <div className="qty">
                  <input className="qty-input" type="number" min="0" step="any" inputMode="decimal" value={l.qty}
                    aria-label={`Quantité en ${UNITS[product.unit]}`}
                    onChange={(e) => setLine(l, { qty: Math.min(available, Math.max(0, Number(e.target.value))) })} />
                  <span>{UNITS[product.unit]}</span>
                </div>
              ) : (
                <div className="qty">
                  <button onClick={() => (l.qty > 1 ? setLine(l, { qty: l.qty - 1 }) : setCart(cart.filter((x) => x !== l)))} aria-label="Moins">−</button>
                  <span>{l.qty}</span>
                  <button onClick={() => (l.qty < available ? setLine(l, { qty: l.qty + 1 })
                    : notify(`Stock insuffisant (disponible : ${available}).`, 'error'))} aria-label="Plus">+</button>
                </div>
              )}
              <input className="price-input" type="number" min="0" inputMode="numeric" value={l.price}
                aria-label="Prix unitaire" onChange={(e) => setLine(l, { price: Number(e.target.value) })} />
              <div className="num">{fmt(Math.round(l.qty * l.price))}</div>
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
            <div className="total"><span>Total</span><strong>{fmt(total)}</strong></div>
            {payment === 'cash' && (
              <div className="cash-row">
                <Field label="Montant reçu">
                  <input type="number" min="0" inputMode="numeric" value={received} placeholder={String(total)}
                    onChange={(e) => setReceived(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
                </Field>
                <div className={`change-box${change != null && change < 0 ? ' neg' : ''}`}>
                  <span>{change != null && change < 0 ? 'Il manque' : 'À rendre'}</span>
                  <strong>{fmt(Math.abs(change ?? 0))}</strong>
                </div>
              </div>
            )}
            {payment === 'credit' && (
              <Field label="Montant versé maintenant" hint={`Reste dû : ${fmt(Math.max(0, total - (Number(paid) || 0)))}`}>
                <input type="number" min="0" inputMode="numeric" value={paid} placeholder="0"
                  onChange={(e) => setPaid(e.target.value)} />
              </Field>
            )}
            <details className="more" open={payment === 'credit'}>
              <summary>{payment === 'credit' ? 'Client (obligatoire)' : 'Client (facultatif)'}</summary>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Client">
                <option value="">— Aucun —</option>
                {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="row">
                <input placeholder="Nouveau client…" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} />
                <button className="btn" disabled={!newCustomer.trim()} onClick={createCustomer}>Créer</button>
              </div>
            </details>
            <button className="btn primary big" onClick={submit}><Icon name="check" size={18} /> Valider la vente <kbd>F4</kbd></button>
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
      {weighing && (
        <Modal title={weighing.name} onClose={() => setWeighing(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (Number(weight) > 0) add(weighing, null, Number(weight)); }}>
            <Field label={`Quantité (${UNITS[weighing.unit]})`}
              hint={`${fmt(weighing.price)} par ${UNITS[weighing.unit]} · en stock : ${fmtQty(weighing.stock, weighing.unit)}`}>
              <input type="number" min="0" step="any" inputMode="decimal" required autoFocus value={weight}
                onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <div className="total"><span>Montant</span><strong>{fmt(Math.round((Number(weight) || 0) * weighing.price))}</strong></div>
            <button className="btn primary big" type="submit">Ajouter au panier</button>
          </form>
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
                <td><strong>{s.number}</strong><div className="muted">{fmtDateTime(s.date)}{s.register && ` · ${s.register}`}{s.seller && ` · ${s.seller}`}</div></td>
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
                    <strong>{fmtQty(i.qty, i.unit)} × {i.name}</strong>
                    <div className="muted">{fmt(i.price)} l'unité{back > 0 && ` · ${back} retourné(s)`}</div>
                  </div>
                  {left > 0 && (
                    <button className="btn small" onClick={() => {
                      const qty = i.unit && i.unit !== 'unit' ? left : 1;
                      return window.confirm(`Enregistrer le retour de ${fmtQty(qty, i.unit)} × « ${i.name} » ? Remis en stock.`) &&
                        run(addReturn, { saleId: sale.id, lineId: i.id, qty }, 'Retour enregistré');
                    }}>
                      {i.unit && i.unit !== 'unit' ? 'Retour' : 'Retour ×1'}
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
            <button className="btn primary" onClick={() => print(<Ticket sale={sale} state={state} fmt={fmt} />)}>
              <Icon name="print" size={16} /> Ticket
            </button>
            <button className="btn" onClick={() => print(<Invoice sale={sale} state={state} fmt={fmt} />)}>Facture A4 / PDF</button>
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

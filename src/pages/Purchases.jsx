import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Tabs, Empty, Modal, Field, fmtDateTime, fmtDate } from '../ui.jsx';
import {
  saveSupplier, deleteSupplier, addPurchase, addSupplierPayment, supplierBalance,
  totalSupplierDebt, hasVariants, PAY_NOW,
} from '../lib/logic.js';

const MethodSelect = ({ value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>
    {Object.entries(PAY_NOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
  </select>
);

function SupplierForm({ supplier, onClose }) {
  const { run } = useStore();
  const [f, setF] = useState(supplier ?? { name: '', phone: '' });
  const submit = (e) => {
    e.preventDefault();
    if (run(saveSupplier, f, supplier ? 'Fournisseur modifié' : 'Fournisseur ajouté')) onClose();
  };
  return (
    <Modal title={supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nom"><input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Téléphone"><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <button className="btn primary big" type="submit">Enregistrer</button>
      </form>
    </Modal>
  );
}

function PurchaseForm({ onClose }) {
  const { state, run, fmt } = useStore();
  const products = state.products.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name));
  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id ?? '');
  const [newSupplier, setNewSupplier] = useState('');
  const [lines, setLines] = useState([{ productId: '', variantId: '', qty: '', cost: '' }]);
  const [paid, setPaid] = useState('');
  const [method, setMethod] = useState('cash');
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0);
  const setLine = (i, patch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const product = (id) => products.find((p) => p.id === id);

  const createSupplier = () => {
    const next = run(saveSupplier, { name: newSupplier });
    if (next) { setSupplierId(next.suppliers.at(-1).id); setNewSupplier(''); }
  };
  const submit = (e) => {
    e.preventDefault();
    const items = lines.filter((l) => l.productId);
    if (run(addPurchase, { supplierId, items, paid: paid === '' ? total : paid, method }, 'Achat enregistré, stock mis à jour')) onClose();
  };

  return (
    <Modal title="Nouvel achat fournisseur" onClose={onClose} wide>
      <form onSubmit={submit}>
        <Field label="Fournisseur">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">— Choisir —</option>
            {state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="row">
          <input placeholder="Nouveau fournisseur…" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />
          <button type="button" className="btn" disabled={!newSupplier.trim()} onClick={createSupplier}>Créer</button>
        </div>

        <fieldset className="variants">
          <legend>Marchandise reçue</legend>
          {lines.map((l, i) => {
            const p = product(l.productId);
            return (
              <div key={i} className="purchase-row">
                <select aria-label="Produit" value={l.productId} required={i === 0}
                  onChange={(e) => setLine(i, { productId: e.target.value, variantId: '', cost: product(e.target.value)?.cost ?? '' })}>
                  <option value="">— Produit —</option>
                  {products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                {hasVariants(p) && (
                  <select aria-label="Variante" value={l.variantId} required onChange={(e) => setLine(i, { variantId: e.target.value })}>
                    <option value="">— Variante —</option>
                    {p.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                )}
                <input aria-label="Quantité" type="number" min="0" step="any" inputMode="decimal" placeholder="Qté" value={l.qty}
                  required={Boolean(l.productId)} onChange={(e) => setLine(i, { qty: e.target.value })} />
                <input aria-label="Prix d'achat unitaire" type="number" min="0" inputMode="numeric" placeholder="Prix d'achat" value={l.cost}
                  required={Boolean(l.productId)} onChange={(e) => setLine(i, { cost: e.target.value })} />
                {lines.length > 1 && (
                  <button type="button" className="icon-btn" aria-label="Retirer la ligne"
                    onClick={() => setLines(lines.filter((_, k) => k !== i))}><Icon name="x" size={17} /></button>
                )}
              </div>
            );
          })}
          <button type="button" className="btn small"
            onClick={() => setLines([...lines, { productId: '', variantId: '', qty: '', cost: '' }])}>
            <Icon name="plus" size={14} /> Ajouter un produit
          </button>
        </fieldset>

        <div className="total"><span>Total de l'achat</span><strong>{fmt(total)}</strong></div>
        <div className="form-grid">
          <Field label="Payé maintenant" hint={`Reste dû au fournisseur : ${fmt(Math.max(0, total - (paid === '' ? total : Number(paid) || 0)))}`}>
            <input type="number" min="0" inputMode="numeric" value={paid} placeholder={String(total)} onChange={(e) => setPaid(e.target.value)} />
          </Field>
          <Field label="Payé par"><MethodSelect value={method} onChange={setMethod} /></Field>
        </div>
        <p className="muted small">Le prix d'achat du produit est recalculé en coût moyen pondéré.</p>
        <button className="btn primary big" type="submit">Enregistrer l'achat</button>
      </form>
    </Modal>
  );
}

function SupplierDetail({ supplier, onClose, onEdit }) {
  const { state, run, fmt } = useStore();
  const balance = supplierBalance(state, supplier.id);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const history = useMemo(() => [
    ...state.purchases.filter((p) => p.supplierId === supplier.id).map((p) => ({
      date: p.date, label: `Achat : ${p.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}`,
      detail: `${fmt(p.total)}, dont ${fmt(p.paid)} payés`, delta: p.total - p.paid,
    })),
    ...state.supplierPayments.filter((p) => p.supplierId === supplier.id).map((p) => ({
      date: p.date, label: 'Paiement', detail: PAY_NOW[p.method], delta: -p.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [state, supplier.id, fmt]);

  const pay = (e) => {
    e.preventDefault();
    if (run(addSupplierPayment, { supplierId: supplier.id, amount, method }, 'Paiement enregistré')) setAmount('');
  };
  const remove = () =>
    window.confirm(`Supprimer le fournisseur « ${supplier.name} » ?`) && run(deleteSupplier, supplier.id, 'Fournisseur supprimé') && onClose();

  return (
    <Modal title={supplier.name} onClose={onClose} wide>
      <div className="debt-box">
        <span>{balance > 0 ? 'Vous lui devez' : 'Rien à payer'}</span>
        <strong className={balance > 0 ? 'neg' : 'pos'}>{fmt(Math.max(0, balance))}</strong>
        {supplier.phone && <small className="muted">{supplier.phone}</small>}
      </div>
      {balance > 0 && (
        <form onSubmit={pay} className="pay-form">
          <Field label="Payer le fournisseur">
            <input type="number" min="1" max={balance} inputMode="numeric" required value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder={`jusqu'à ${balance}`} />
          </Field>
          <Field label="Mode"><MethodSelect value={method} onChange={setMethod} /></Field>
          <button className="btn primary" type="submit">Payer</button>
        </form>
      )}
      <div className="row">
        <button className="btn" onClick={onEdit}><Icon name="edit" size={16} /> Modifier</button>
        {!history.length && <button className="btn" onClick={remove}><Icon name="trash" size={16} /> Supprimer</button>}
      </div>
      <h3>Historique</h3>
      {history.length ? (
        <ul className="plain history">
          {history.map((h, i) => (
            <li key={i} className="rank-line">
              <div><strong>{h.label}</strong><div className="muted">{fmtDateTime(h.date)} · {h.detail}</div></div>
              {h.delta !== 0 && <span className={`num ${h.delta > 0 ? 'neg' : 'pos'}`}>{h.delta > 0 ? '+' : '−'}{fmt(Math.abs(h.delta))}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="muted">Aucun achat pour le moment.</p>}
    </Modal>
  );
}

export default function Purchases() {
  const { state, fmt } = useStore();
  const [tab, setTab] = useState('purchases');
  const [buying, setBuying] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const purchases = useMemo(() => [...state.purchases].sort((a, b) => b.date.localeCompare(a.date)), [state.purchases]);
  const suppliers = useMemo(
    () => state.suppliers.map((s) => ({ s, balance: supplierBalance(state, s.id) }))
      .sort((a, b) => b.balance - a.balance || a.s.name.localeCompare(b.s.name)),
    [state],
  );
  const supplierName = (id) => state.suppliers.find((s) => s.id === id)?.name ?? '—';
  const open = state.suppliers.find((s) => s.id === openId);
  const hasProducts = state.products.some((p) => !p.archived);

  return (
    <>
      <PageHead title="Achats & fournisseurs" sub={`${fmt(totalSupplierDebt(state))} dus aux fournisseurs`}>
        <button className="btn" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Fournisseur</button>
        <button className="btn primary" disabled={!hasProducts} onClick={() => setBuying(true)}><Icon name="truck" size={16} /> Nouvel achat</button>
      </PageHead>
      <Tabs value={tab} onChange={setTab} options={[['purchases', 'Achats'], ['suppliers', 'Fournisseurs']]} />

      {tab === 'purchases' ? (
        !purchases.length ? (
          <div className="card"><Empty icon="truck" title="Aucun achat enregistré">
            Enregistrez vos achats de marchandise : le stock est mis à jour et vous suivez ce que vous devez à chaque fournisseur.
          </Empty></div>
        ) : (
          <section className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Fournisseur</th><th>Marchandise</th><th className="r">Total</th><th className="r">Reste dû</th></tr></thead>
                <tbody>
                  {purchases.slice(0, 100).map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => setOpenId(p.supplierId)}>
                      <td>{fmtDate(p.date)}</td>
                      <td>{supplierName(p.supplierId)}</td>
                      <td>{p.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</td>
                      <td className="r num">{fmt(p.total)}</td>
                      <td className="r num">{p.total > p.paid ? fmt(p.total - p.paid) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : !suppliers.length ? (
        <div className="card"><Empty icon="users" title="Aucun fournisseur">Ajoutez vos fournisseurs pour enregistrer vos achats.</Empty></div>
      ) : (
        <section className="card">
          <ul className="plain list">
            {suppliers.map(({ s, balance }) => (
              <li key={s.id}>
                <button className="list-row" onClick={() => setOpenId(s.id)}>
                  <span className="avatar">{s.name.slice(0, 1).toUpperCase()}</span>
                  <span className="grow"><strong>{s.name}</strong><span className="muted">{s.phone || 'Pas de téléphone'}</span></span>
                  {balance > 0 ? <span className="badge warn">à payer {fmt(balance)}</span> : <span className="badge ok">à jour</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {buying && <PurchaseForm onClose={() => setBuying(false)} />}
      {open && !editing && <SupplierDetail supplier={open} onClose={() => setOpenId(null)} onEdit={() => setEditing(open)} />}
      {editing && <SupplierForm supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

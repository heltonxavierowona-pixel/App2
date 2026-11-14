import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Tabs, Empty, Modal, Field, fmtDateTime } from '../ui.jsx';
import { addMovement, stockValue, hasVariants } from '../lib/logic.js';
import { velocities } from '../lib/insights.js';

const TYPES = {
  in: 'Entrée', out: 'Sortie', adjust: 'Inventaire', sale: 'Vente', return: 'Retour client', purchase: 'Achat',
};
const REASONS = {
  in: ['Livraison fournisseur', 'Achat au marché', 'Autre'],
  out: ['Produit abîmé', 'Perte / vol', 'Usage personnel', 'Don', 'Autre'],
  adjust: ['Inventaire'],
};

function MovementForm({ preset, onClose }) {
  const { state, run } = useStore();
  const products = state.products.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name));
  const [type, setType] = useState(preset?.type ?? 'in');
  const [productId, setProductId] = useState(preset?.productId ?? products[0]?.id ?? '');
  const [qty, setQty] = useState(preset?.qty ?? '');
  const [reason, setReason] = useState(REASONS[preset?.type ?? 'in'][0]);
  const [variantId, setVariantId] = useState('');
  const product = products.find((p) => p.id === productId);
  const variant = product?.variants?.find((v) => v.id === variantId);
  const current = variant ? variant.stock : product?.stock;
  const submit = (e) => {
    e.preventDefault();
    if (run(addMovement, { productId, variantId, type, qty, reason }, 'Stock mis à jour')) onClose();
  };
  return (
    <Modal title="Mouvement de stock" onClose={onClose}>
      <form onSubmit={submit}>
        <Tabs value={type} onChange={(t) => { setType(t); setReason(REASONS[t][0]); }}
          options={[['in', 'Entrée'], ['out', 'Sortie'], ['adjust', 'Inventaire']]} />
        <Field label="Produit">
          <select value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(''); }} required>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock : {p.stock})</option>)}
          </select>
        </Field>
        {hasVariants(product) && (
          <Field label="Variante">
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} required>
              <option value="">— Choisir —</option>
              {product.variants.map((v) => <option key={v.id} value={v.id}>{v.label} (stock : {v.stock})</option>)}
            </select>
          </Field>
        )}
        <Field label={type === 'adjust' ? 'Stock réel compté' : 'Quantité'}
          hint={type === 'adjust' && product ? `Stock enregistré actuellement : ${current}` : null}>
          <input type="number" min="0" inputMode="numeric" required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        {type !== 'adjust' && (
          <Field label="Motif">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS[type].map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
        )}
        <button className="btn primary big" type="submit">Enregistrer</button>
      </form>
    </Modal>
  );
}

export default function Stock() {
  const { state, fmt, canManage } = useStore();
  const [tab, setTab] = useState('levels');
  const [form, setForm] = useState(null);
  const [limit, setLimit] = useState(50);

  const rows = useMemo(
    () => velocities(state).sort((a, b) => a.daysLeft - b.daysLeft || a.product.name.localeCompare(b.product.name)),
    [state],
  );
  const movements = useMemo(() => [...state.movements].sort((a, b) => b.date.localeCompare(a.date)), [state.movements]);
  const value = stockValue(state);
  const name = (m) => {
    const p = state.products.find((x) => x.id === m.productId);
    if (!p) return 'Produit supprimé';
    const v = p.variants?.find((x) => x.id === m.variantId);
    return v ? `${p.name} (${v.label})` : p.name;
  };
  const alerts = rows.filter((r) => r.product.stock <= r.product.minStock).length;

  return (
    <>
      <PageHead title="Stock" sub={canManage ? `Valeur du stock : ${fmt(value.cost)} au prix d'achat` : 'Niveaux de stock'}>
        {canManage && <button className="btn primary" disabled={!rows.length} onClick={() => setForm({})}><Icon name="plus" size={16} /> Mouvement</button>}
      </PageHead>
      <Tabs value={tab} onChange={setTab}
        options={[['levels', `Niveaux${alerts ? ` (${alerts} alerte${alerts > 1 ? 's' : ''})` : ''}`], ['history', 'Historique']]} />

      {!rows.length ? (
        <div className="card"><Empty icon="layers" title="Aucun produit en stock">Ajoutez des produits pour suivre leur stock.</Empty></div>
      ) : tab === 'levels' ? (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produit</th><th className="r">Stock</th><th className="r">Seuil</th>
                <th className="r">Ventes / sem.</th><th className="r">Autonomie</th><th className="r">À commander</th><th /></tr></thead>
              <tbody>
                {rows.map(({ product: p, perDay, daysLeft, suggestedOrder }) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong>
                      <div className="muted">{hasVariants(p) ? p.variants.map((v) => `${v.label} : ${v.stock}`).join(' · ') : p.category}</div></td>
                    <td className="r"><span className={`badge ${p.stock <= 0 ? 'crit' : p.stock <= p.minStock ? 'warn' : 'ok'}`}>{p.stock}</span></td>
                    <td className="r num">{p.minStock}</td>
                    <td className="r num">{perDay ? (perDay * 7).toFixed(1) : '—'}</td>
                    <td className={`r num ${daysLeft <= 7 ? 'neg' : ''}`}>{Number.isFinite(daysLeft) ? `${Math.round(daysLeft)} j` : '—'}</td>
                    <td className="r num">{suggestedOrder || '—'}</td>
                    <td className="r">
                      {canManage && <button className="btn small" onClick={() => setForm({ productId: p.id, type: 'in', qty: hasVariants(p) ? '' : suggestedOrder || '' })}>Entrée</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">« À commander » : quantité estimée pour couvrir 30 jours au rythme de vente des 30 derniers jours.</p>
        </section>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Motif</th><th className="r">Quantité</th></tr></thead>
              <tbody>
                {movements.slice(0, limit).map((m) => (
                  <tr key={m.id}>
                    <td>{fmtDateTime(m.date)}</td>
                    <td>{name(m)}</td>
                    <td>{TYPES[m.type]}</td>
                    <td className="muted">{m.reason}</td>
                    <td className={`r num ${m.qty < 0 ? 'neg' : 'pos'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {movements.length > limit && <button className="link" onClick={() => setLimit(limit + 50)}>Afficher plus…</button>}
        </section>
      )}

      {form && <MovementForm preset={form} onClose={() => setForm(null)} />}
    </>
  );
}

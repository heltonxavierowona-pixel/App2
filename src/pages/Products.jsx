import React, { useCallback, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Empty, Modal, Field } from '../ui.jsx';
import { saveProduct, deleteProduct, hasVariants, UNITS, isMeasured, fmtQty } from '../lib/logic.js';
import Scanner from '../components/Scanner.jsx';

const BLANK = { name: '', code: '', barcode: '', category: '', unit: 'unit', cost: '', price: '', stock: '', minStock: '', variants: [] };

export function ProductForm({ product, onClose }) {
  const { state, run } = useStore();
  const [f, setF] = useState(product ? { ...BLANK, ...product, variants: product.variants ?? [] } : BLANK);
  const [scanFor, setScanFor] = useState(null); // 'product' | index de variante
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setVariant = (i, patch) =>
    setF({ ...f, variants: f.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)) });
  const categories = [...new Set(state.products.map((p) => p.category))].sort();
  const cost = Number(f.cost) || 0, price = Number(f.price) || 0;
  const withVariants = f.variants.length > 0;
  const measured = isMeasured(f);
  const suffix = measured ? ` (par ${UNITS[f.unit]})` : '';

  const onScan = useCallback((code) => {
    setF((cur) => (scanFor === 'product'
      ? { ...cur, barcode: code }
      : { ...cur, variants: cur.variants.map((v, k) => (k === scanFor ? { ...v, barcode: code } : v)) }));
    setScanFor(null);
  }, [scanFor]);

  const submit = (e) => {
    e.preventDefault();
    if (run(saveProduct, f, product ? 'Produit modifié' : 'Produit ajouté')) onClose();
  };

  if (scanFor !== null) return <Scanner onDetect={onScan} onClose={() => setScanFor(null)} />;

  return (
    <Modal title={product ? 'Modifier le produit' : 'Nouveau produit'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <Field label="Nom du produit"><input autoFocus required value={f.name} onChange={set('name')} /></Field>
        <div className="form-grid">
          <Field label="Code interne"><input value={f.code} onChange={set('code')} placeholder="ex. CH-001" /></Field>
          <Field label="Catégorie">
            <input value={f.category} onChange={set('category')} list="categories" placeholder="ex. Chaussures" />
            <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Vendu" hint={measured ? 'Les prix et le stock sont exprimés dans cette unité' : null}>
            <select value={f.unit ?? 'unit'} onChange={set('unit')} disabled={withVariants}>
              <option value="unit">À la pièce</option>
              <option value="kg">Au poids (kg)</option>
              <option value="g">Au poids (g)</option>
              <option value="l">Au volume (L)</option>
              <option value="m">À la longueur (m)</option>
            </select>
          </Field>
          <span />
          <Field label={`Prix d'achat${suffix}`}><input type="number" min="0" inputMode="numeric" required value={f.cost} onChange={set('cost')} /></Field>
          <Field label={`Prix de vente${suffix}`}><input type="number" min="0" inputMode="numeric" required value={f.price} onChange={set('price')} /></Field>
          {!product && !withVariants && (
            <Field label="Stock initial"><input type="number" min="0" step="any" inputMode="decimal" value={f.stock} onChange={set('stock')} placeholder="0" /></Field>
          )}
          <Field label="Seuil minimum" hint="Alerte quand le stock total atteint ce niveau">
            <input type="number" min="0" inputMode="numeric" value={f.minStock} onChange={set('minStock')} placeholder="0" />
          </Field>
        </div>
        <Field label="Code-barres">
          <div className="row">
            <input value={f.barcode} onChange={set('barcode')} inputMode="numeric" placeholder="Scannez ou saisissez" />
            <button type="button" className="btn" onClick={() => setScanFor('product')}><Icon name="scan" size={16} /> Scanner</button>
          </div>
        </Field>

        {!measured && <fieldset className="variants">
          <legend>Variantes (tailles, couleurs…)</legend>
          {!withVariants && <p className="muted small">Facultatif. Utile pour suivre le stock par pointure ou par couleur.</p>}
          {f.variants.map((v, i) => (
            <div key={v.id ?? `n${i}`} className="variant-row">
              <input aria-label="Nom de la variante" placeholder="ex. 42 / Noir" value={v.label}
                onChange={(e) => setVariant(i, { label: e.target.value })} />
              {v.id
                ? <span className="badge ok" title="Stock actuel">{v.stock}</span>
                : <input aria-label="Stock initial" type="number" min="0" inputMode="numeric" placeholder="Stock"
                    value={v.stock ?? ''} onChange={(e) => setVariant(i, { stock: e.target.value })} />}
              <input aria-label="Code-barres de la variante" placeholder="Code-barres" value={v.barcode ?? ''}
                inputMode="numeric" onChange={(e) => setVariant(i, { barcode: e.target.value })} />
              <button type="button" className="icon-btn" aria-label="Scanner" onClick={() => setScanFor(i)}><Icon name="scan" size={17} /></button>
              <button type="button" className="icon-btn" aria-label="Retirer la variante"
                onClick={() => setF({ ...f, variants: f.variants.filter((_, k) => k !== i) })}><Icon name="x" size={17} /></button>
            </div>
          ))}
          <button type="button" className="btn small"
            onClick={() => setF({ ...f, variants: [...f.variants, { label: '', stock: '', barcode: '' }] })}>
            <Icon name="plus" size={14} /> Ajouter une variante
          </button>
        </fieldset>}

        {price > 0 && (
          <p className={`note ${price <= cost ? 'neg' : ''}`}>
            Marge par unité : <strong>{price - cost}</strong> ({Math.round(((price - cost) / price) * 100)} %)
            {price <= cost && ' — attention, ce produit serait vendu à perte.'}
          </p>
        )}
        {product && <p className="muted small">Le stock se modifie depuis les écrans « Stock » et « Achats ».</p>}
        <button className="btn primary big" type="submit">Enregistrer</button>
      </form>
    </Modal>
  );
}

export default function Products() {
  const { state, run, fmt } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | product

  const active = state.products.filter((p) => !p.archived);
  const categories = [...new Set(active.map((p) => p.category))].sort();
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active
      .filter((p) => !category || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.barcode === q)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.products, query, category]);

  const remove = (p) =>
    window.confirm(`Supprimer « ${p.name} » du catalogue ?`) && run(deleteProduct, p.id, 'Produit supprimé');

  return (
    <>
      <PageHead title="Produits" sub={`${active.length} produit(s) au catalogue`}>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Nouveau produit</button>
      </PageHead>

      {!active.length ? (
        <div className="card"><Empty icon="box" title="Catalogue vide">Ajoutez vos produits avec leur prix d'achat et de vente pour suivre votre marge.</Empty></div>
      ) : (
        <section className="card">
          <div className="filters">
            <div className="search">
              <Icon name="search" size={16} />
              <input placeholder="Chercher par nom ou code…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Catégorie">
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Produit</th><th>Catégorie</th><th className="r">Achat</th><th className="r">Vente</th>
                  <th className="r">Marge</th><th className="r">Stock</th><th /></tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const rate = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong>
                        <div className="muted">{[p.code, hasVariants(p) && `${p.variants.length} variantes`].filter(Boolean).join(' · ')}</div></td>
                      <td>{p.category}</td>
                      <td className="r num">{fmt(p.cost)}</td>
                      <td className="r num">{fmt(p.price)}</td>
                      <td className={`r num ${rate < 10 ? 'neg' : ''}`}>{rate} %</td>
                      <td className="r">
                        <span className={`badge ${p.stock <= 0 ? 'crit' : p.stock <= p.minStock ? 'warn' : 'ok'}`}>{fmtQty(p.stock, p.unit)}</span>
                      </td>
                      <td className="r nowrap">
                        <button className="icon-btn" onClick={() => setEditing(p)} aria-label={`Modifier ${p.name}`}><Icon name="edit" size={17} /></button>
                        <button className="icon-btn" onClick={() => remove(p)} aria-label={`Supprimer ${p.name}`}><Icon name="trash" size={17} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!list.length && <p className="muted">Aucun produit ne correspond.</p>}
        </section>
      )}

      {editing && <ProductForm product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

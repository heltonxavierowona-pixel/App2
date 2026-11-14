import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Empty, Modal, Field } from '../ui.jsx';
import { saveProduct, deleteProduct } from '../lib/logic.js';

const BLANK = { name: '', code: '', category: '', cost: '', price: '', stock: '', minStock: '' };

export function ProductForm({ product, onClose }) {
  const { state, run } = useStore();
  const [f, setF] = useState(product ?? BLANK);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const categories = [...new Set(state.products.map((p) => p.category))].sort();
  const cost = Number(f.cost) || 0, price = Number(f.price) || 0;
  const submit = (e) => {
    e.preventDefault();
    if (run(saveProduct, f, product ? 'Produit modifié' : 'Produit ajouté')) onClose();
  };
  return (
    <Modal title={product ? 'Modifier le produit' : 'Nouveau produit'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nom du produit"><input autoFocus required value={f.name} onChange={set('name')} /></Field>
        <div className="form-grid">
          <Field label="Code interne"><input value={f.code} onChange={set('code')} placeholder="ex. CH-001" /></Field>
          <Field label="Catégorie">
            <input value={f.category} onChange={set('category')} list="categories" placeholder="ex. Chaussures" />
            <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Prix d'achat"><input type="number" min="0" inputMode="numeric" required value={f.cost} onChange={set('cost')} /></Field>
          <Field label="Prix de vente"><input type="number" min="0" inputMode="numeric" required value={f.price} onChange={set('price')} /></Field>
          {!product && (
            <Field label="Stock initial"><input type="number" min="0" inputMode="numeric" value={f.stock} onChange={set('stock')} placeholder="0" /></Field>
          )}
          <Field label="Seuil minimum" hint="Alerte quand le stock atteint ce niveau">
            <input type="number" min="0" inputMode="numeric" value={f.minStock} onChange={set('minStock')} placeholder="0" />
          </Field>
        </div>
        {price > 0 && (
          <p className={`note ${price <= cost ? 'neg' : ''}`}>
            Marge par unité : <strong>{price - cost}</strong> ({Math.round(((price - cost) / price) * 100)} %)
            {price <= cost && ' — attention, ce produit serait vendu à perte.'}
          </p>
        )}
        {product && <p className="muted">Le stock se modifie depuis l'écran « Stock » (entrées, sorties, inventaire).</p>}
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
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
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
                      <td><strong>{p.name}</strong>{p.code && <div className="muted">{p.code}</div>}</td>
                      <td>{p.category}</td>
                      <td className="r num">{fmt(p.cost)}</td>
                      <td className="r num">{fmt(p.price)}</td>
                      <td className={`r num ${rate < 10 ? 'neg' : ''}`}>{rate} %</td>
                      <td className="r">
                        <span className={`badge ${p.stock <= 0 ? 'crit' : p.stock <= p.minStock ? 'warn' : 'ok'}`}>{p.stock}</span>
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

import React, { useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { PageHead, Field, download, toCSV, fmtDateTime } from '../ui.jsx';
import { emptyState, PAYMENTS } from '../lib/logic.js';
import { demoState } from '../lib/demo.js';

export default function Settings() {
  const { state, setState, notify } = useStore();
  const [f, setF] = useState(state.settings);
  const fileRef = useRef(null);
  const hasData = state.products.length || state.sales.length || state.customers.length || state.expenses.length;
  const stamp = new Date().toISOString().slice(0, 10);

  const save = (e) => {
    e.preventDefault();
    setState({
      ...state,
      settings: { shopName: f.shopName.trim() || 'Ma boutique', currency: f.currency.trim() || 'FCFA' },
    });
    notify('Réglages enregistrés');
  };

  const loadDemo = () => {
    if (hasData && !window.confirm('Charger la démo remplacera toutes vos données actuelles. Continuer ?')) return;
    setState(demoState());
    notify('Données de démonstration chargées');
  };

  const reset = () => {
    if (!window.confirm('Effacer TOUTES les données (produits, ventes, clients, dépenses) ? Cette action est définitive.')) return;
    setState({ ...emptyState(), settings: state.settings });
    notify('Données effacées');
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error();
      if (hasData && !window.confirm('Restaurer cette sauvegarde remplacera vos données actuelles. Continuer ?')) return;
      setState({ ...emptyState(), ...data });
      setF({ ...emptyState().settings, ...data.settings });
      notify('Sauvegarde restaurée');
    } catch {
      notify("Ce fichier n'est pas une sauvegarde COMMERCE AI valide.", 'error');
    }
  };

  const exportSales = () => {
    const customer = (id) => state.customers.find((c) => c.id === id)?.name ?? '';
    const rows = [['Date', 'Produit', 'Quantité', 'Prix unitaire', "Prix d'achat", 'Remise vente', 'Total vente', 'Paiement', 'Client']];
    for (const s of state.sales)
      for (const i of s.items)
        rows.push([fmtDateTime(s.date), i.name, i.qty, i.price, i.cost, s.discount, s.total, PAYMENTS[s.payment], customer(s.customerId)]);
    download(`ventes-${stamp}.csv`, toCSV(rows), 'text/csv');
  };

  const exportProducts = () => {
    const rows = [['Nom', 'Code', 'Catégorie', "Prix d'achat", 'Prix de vente', 'Stock', 'Seuil minimum']];
    for (const p of state.products.filter((x) => !x.archived))
      rows.push([p.name, p.code, p.category, p.cost, p.price, p.stock, p.minStock]);
    download(`produits-${stamp}.csv`, toCSV(rows), 'text/csv');
  };

  return (
    <>
      <PageHead title="Réglages" sub="Boutique, sauvegardes et exports" />

      <section className="card">
        <h3>Ma boutique</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Nom de la boutique"><input value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} /></Field>
            <Field label="Devise"><input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} placeholder="FCFA, GNF, CDF, €…" /></Field>
          </div>
          <button className="btn primary" type="submit">Enregistrer</button>
        </form>
      </section>

      <section className="card">
        <h3>Sauvegarde</h3>
        <p className="muted">
          Vos données sont enregistrées sur cet appareil uniquement et l'application fonctionne sans connexion.
          Téléchargez régulièrement une sauvegarde pour ne rien perdre, ou pour transférer vos données sur un autre appareil.
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => download(`commerce-ai-sauvegarde-${stamp}.json`, JSON.stringify(state), 'application/json')}>
            Télécharger la sauvegarde
          </button>
          <button className="btn" onClick={() => fileRef.current.click()}>Restaurer une sauvegarde</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
        </div>
      </section>

      <section className="card">
        <h3>Exports pour Excel</h3>
        <div className="row">
          <button className="btn" disabled={!state.sales.length} onClick={exportSales}>Ventes (CSV)</button>
          <button className="btn" disabled={!state.products.length} onClick={exportProducts}>Produits (CSV)</button>
        </div>
      </section>

      <section className="card">
        <h3>Données</h3>
        <div className="row">
          <button className="btn" onClick={loadDemo}>Charger les données de démonstration</button>
          <button className="btn danger" disabled={!hasData} onClick={reset}>Tout effacer</button>
        </div>
      </section>
    </>
  );
}

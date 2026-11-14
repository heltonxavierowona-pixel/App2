import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Field, download, toCSV, fmtDateTime } from '../ui.jsx';
import { emptyState, PAYMENTS, updateSettings, replaceAll } from '../lib/logic.js';
import { demoState } from '../lib/demo.js';
import { listMembers, inviteSeller, removeMember } from '../lib/cloud.js';

const SYNC_LABEL = {
  local: 'Données sur cet appareil uniquement',
  syncing: 'Synchronisation en cours…',
  synced: 'Synchronisé',
  offline: 'Hors connexion : les opérations seront envoyées au retour du réseau',
  error: 'Synchronisation impossible pour le moment',
};

function Team() {
  const { shop, notify, session } = useStore();
  const [members, setMembers] = useState(null);
  const [email, setEmail] = useState('');
  const load = () => listMembers(shop.id).then(setMembers).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, [shop.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async (e) => {
    e.preventDefault();
    try { await inviteSeller(shop.id, email); setEmail(''); notify('Vendeur ajouté'); load(); }
    catch (err) { notify(/duplicate|23505/.test(`${err.code} ${err.message}`) ? 'Cette personne fait déjà partie de la boutique.' : err.message, 'error'); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Retirer ${m.email} de la boutique ?`)) return;
    try { await removeMember(shop.id, m.email); load(); } catch (err) { notify(err.message, 'error'); }
  };

  return (
    <section className="card">
      <h3>Équipe</h3>
      <p className="muted small">
        Un vendeur peut enregistrer des ventes, des retours, des règlements clients et clôturer la caisse.
        Il ne voit ni le tableau de bord, ni les dépenses, ni les réglages. Il ouvre son propre compte avec l'adresse saisie ici.
      </p>
      <ul className="plain">
        {(members ?? []).map((m) => (
          <li key={m.email} className="rank-line">
            <span>{m.email}{m.email === session.email && ' (vous)'}</span>
            <span className="row">
              <span className={`badge ${m.role === 'owner' ? 'ok' : 'warn'}`}>{m.role === 'owner' ? 'Patron' : 'Vendeur'}</span>
              {m.role !== 'owner' && (
                <button className="icon-btn" aria-label={`Retirer ${m.email}`} onClick={() => remove(m)}><Icon name="trash" size={16} /></button>
              )}
            </span>
          </li>
        ))}
        {members === null && <li className="muted">Chargement…</li>}
      </ul>
      <form className="row" onSubmit={invite}>
        <input type="email" required placeholder="E-mail du vendeur" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn primary" type="submit">Ajouter un vendeur</button>
      </form>
    </section>
  );
}

export default function Settings() {
  const { state, run, notify, session, shop, isOwner, auth, syncStatus, pendingCount, sync } = useStore();
  const [f, setF] = useState(state.settings);
  const [newShop, setNewShop] = useState({ name: '', currency: state.settings.currency });
  const fileRef = useRef(null);
  const hasData = state.products.length || state.sales.length || state.customers.length || state.expenses.length;
  const stamp = new Date().toISOString().slice(0, 10);
  useEffect(() => { setF(state.settings); }, [shop?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (e) => { e.preventDefault(); run(updateSettings, f, 'Réglages enregistrés'); };

  const createShop = async (e) => {
    e.preventDefault();
    try { await auth.createShop(newShop); setNewShop({ name: '', currency: newShop.currency }); notify('Boutique créée'); }
    catch (err) { notify(err.message, 'error'); }
  };

  const loadDemo = () => {
    if (hasData && !window.confirm('Charger la démo remplacera toutes les données de cette boutique. Continuer ?')) return;
    run(replaceAll, { data: demoState() }, 'Données de démonstration chargées');
  };
  const reset = () => {
    if (!window.confirm('Effacer TOUTES les données de cette boutique (produits, ventes, clients, dépenses) ? Cette action est définitive.')) return;
    run(replaceAll, { data: emptyState() }, 'Données effacées');
  };
  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error();
      if (hasData && !window.confirm('Restaurer cette sauvegarde remplacera les données de cette boutique. Continuer ?')) return;
      run(replaceAll, { data }, 'Sauvegarde restaurée');
    } catch { notify("Ce fichier n'est pas une sauvegarde valide.", 'error'); }
  };

  const exportSales = () => {
    const customer = (id) => state.customers.find((c) => c.id === id)?.name ?? '';
    const rows = [['Facture', 'Date', 'Produit', 'Quantité', 'Prix unitaire', "Prix d'achat", 'Remise vente', 'Total vente', 'Paiement', 'Client', 'Vendeur']];
    for (const s of state.sales)
      for (const i of s.items)
        rows.push([s.number, fmtDateTime(s.date), i.name, i.qty, i.price, i.cost, s.discount, s.total, PAYMENTS[s.payment], customer(s.customerId), s.seller]);
    download(`ventes-${stamp}.csv`, toCSV(rows), 'text/csv');
  };
  const exportProducts = () => {
    const rows = [['Nom', 'Variante', 'Code', 'Code-barres', 'Catégorie', "Prix d'achat", 'Prix de vente', 'Stock', 'Seuil minimum']];
    for (const p of state.products.filter((x) => !x.archived)) {
      if (p.variants?.length)
        for (const v of p.variants) rows.push([p.name, v.label, p.code, v.barcode || p.barcode, p.category, p.cost, p.price, v.stock, p.minStock]);
      else rows.push([p.name, '', p.code, p.barcode, p.category, p.cost, p.price, p.stock, p.minStock]);
    }
    download(`produits-${stamp}.csv`, toCSV(rows), 'text/csv');
  };

  const logout = () => {
    if (pendingCount && !window.confirm(`${pendingCount} opération(s) n'ont pas encore été envoyées et seront perdues. Se déconnecter quand même ?`)) return;
    auth.signOut();
  };

  return (
    <>
      <PageHead title="Réglages" sub="Boutique, équipe, compte et sauvegardes" />

      <section className="card">
        <h3>Ma boutique</h3>
        <form onSubmit={save}>
          <Field label="Nom de la boutique"
            hint="Enregistré à l'ouverture du compte : c'est le nom imprimé sur vos factures. Il ne peut pas être modifié.">
            <input value={state.settings.shopName} readOnly disabled />
          </Field>
          {isOwner && (
            <>
              <div className="form-grid">
                <Field label="Téléphone (sur les factures)"><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
                <Field label="Devise"><input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} placeholder="FCFA, GNF, CDF, €…" /></Field>
              </div>
              <Field label="Adresse (sur les factures)"><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Quartier, ville" /></Field>
              <button className="btn primary" type="submit">Enregistrer</button>
            </>
          )}
        </form>
      </section>

      <section className="card">
        <h3>Mes boutiques</h3>
        <ul className="plain">
          {session.shops.map((s) => (
            <li key={s.id} className="rank-line">
              <span><strong>{s.name}</strong> <span className="muted">· {s.role === 'owner' ? 'Patron' : 'Vendeur'}</span></span>
              {s.id === shop.id
                ? <span className="badge ok">Ouverte</span>
                : <button className="btn small" onClick={() => auth.switchShop(s.id)}>Ouvrir</button>}
            </li>
          ))}
        </ul>
        <form onSubmit={createShop}>
          <div className="form-grid">
            <Field label="Nouvelle boutique" hint="Ce nom figurera sur ses factures et ne pourra plus être modifié.">
              <input required maxLength={80} value={newShop.name} onChange={(e) => setNewShop({ ...newShop, name: e.target.value })} placeholder="Nom de la boutique" />
            </Field>
            <Field label="Devise"><input value={newShop.currency} onChange={(e) => setNewShop({ ...newShop, currency: e.target.value })} /></Field>
          </div>
          <button className="btn" type="submit"><Icon name="plus" size={16} /> Créer la boutique</button>
        </form>
      </section>

      {session.mode === 'cloud' && isOwner && <Team />}

      <section className="card">
        <h3>Compte</h3>
        <ul className="plain">
          <li className="rank-line"><span>Utilisateur</span><span>{session.userName}{session.email && ` · ${session.email}`}</span></li>
          <li className="rank-line"><span>État</span>
            <span>{SYNC_LABEL[syncStatus]}{pendingCount > 0 && ` · ${pendingCount} en attente`}</span></li>
        </ul>
        {session.mode === 'cloud' ? (
          <div className="row">
            <button className="btn" onClick={sync}>Synchroniser maintenant</button>
            <button className="btn danger" onClick={logout}>Se déconnecter</button>
          </div>
        ) : (
          <p className="muted small">
            Compte sans synchronisation : téléchargez régulièrement une sauvegarde, c'est la seule copie de vos données.
          </p>
        )}
      </section>

      {isOwner && (
        <>
          <section className="card">
            <h3>Sauvegarde et exports</h3>
            <div className="row">
              <button className="btn primary" onClick={() => download(`numera-commercial-${stamp}.json`, JSON.stringify(state), 'application/json')}>
                Télécharger la sauvegarde
              </button>
              <button className="btn" onClick={() => fileRef.current.click()}>Restaurer une sauvegarde</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
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
      )}
    </>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Empty } from '../ui.jsx';
import { consolidate, monthKeyOf, money } from '../lib/overview.js';
import { APP_NAME } from '../config.js';

const change = (cur, old) => (old ? `${cur >= old ? '+' : ''}${Math.round(((cur - old) / Math.abs(old)) * 100)} %` : '—');

// Tableau comparatif des boutiques, partagé entre l'écran et l'impression.
function Comparison({ c }) {
  const t = c.total;
  return (
    <table>
      <thead>
        <tr><th>Boutique</th><th className="r">Chiffre d'affaires</th><th className="r">Marge</th>
          <th className="r">Dépenses</th><th className="r">Bénéfice estimé</th><th className="r">Ventes</th></tr>
      </thead>
      <tbody>
        {c.ranking.map((r, i) => (
          <tr key={r.id}>
            <td className="nowrap">{i + 1}. {r.name}</td>
            <td className="r num">{money(r.m.revenue, r.currency)}</td>
            <td className="r num">{money(r.m.margin, r.currency)}</td>
            <td className="r num">{money(r.m.expenses, r.currency)}</td>
            <td className="r num">{money(r.m.net, r.currency)}</td>
            <td className="r num">{r.m.salesCount}</td>
          </tr>
        ))}
        {t && c.rows.length > 1 && (
          <tr className="strong">
            <td>Total</td>
            <td className="r num">{money(t.m.revenue, t.currency)}</td>
            <td className="r num">{money(t.m.margin, t.currency)}</td>
            <td className="r num">{money(t.m.expenses, t.currency)}</td>
            <td className="r num">{money(t.m.net, t.currency)}</td>
            <td className="r num">{t.m.salesCount}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Situation({ c }) {
  return (
    <table>
      <thead>
        <tr><th>Boutique</th><th className="r">Stock (prix d'achat)</th><th className="r">Dettes clients</th>
          <th className="r">Dû aux fournisseurs</th><th className="r">Ruptures</th><th className="r">Écart de caisse</th></tr>
      </thead>
      <tbody>
        {c.rows.map((r) => (
          <tr key={r.id}>
            <td className="nowrap">{r.name}</td>
            <td className="r num">{money(r.stock.cost, r.currency)}</td>
            <td className="r num">{money(r.debt, r.currency)}</td>
            <td className="r num">{money(r.supplierDebt, r.currency)}</td>
            <td className="r num">{r.outCount} · {r.lowCount} sous le seuil</td>
            <td className="r num">{money(r.closingGap, r.currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Détail d'une boutique (annexe du rapport général).
function ShopDetail({ r }) {
  return (
    <section>
      <h3>{r.name}</h3>
      <p className="small">
        Chiffre d'affaires {money(r.m.revenue, r.currency)} ({change(r.m.revenue, r.prev.revenue)} sur un mois) ·
        marge {money(r.m.margin, r.currency)} ({Math.round(r.m.marginRate * 100)} %) ·
        dépenses {money(r.m.expenses, r.currency)} · bénéfice estimé {money(r.m.net, r.currency)}
      </p>
      {r.top.length > 0 && (
        <table>
          <thead><tr><th>Produits les plus vendus</th><th className="r">Quantité</th><th className="r">Chiffre</th><th className="r">Marge</th></tr></thead>
          <tbody>
            {r.top.map((t) => (
              <tr key={t.productId}><td>{t.name}</td><td className="r num">{t.qty}</td>
                <td className="r num">{money(t.revenue, r.currency)}</td><td className="r num">{money(t.margin, r.currency)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {r.expenses.length > 0 && (
        <p className="small muted">Dépenses : {r.expenses.map(([cat, v]) => `${cat} ${money(v, r.currency)}`).join(' · ')}</p>
      )}
    </section>
  );
}

export default function Overview() {
  const { loadShopStates, print, session, auth, state } = useStore();
  const [key, setKey] = useState(monthKeyOf(new Date()));
  const [shops, setShops] = useState(null);

  // `state` en dépendance : la boutique ouverte reste à jour dans la vue d'ensemble.
  useEffect(() => {
    let cancelled = false;
    loadShopStates().then((list) => { if (!cancelled) setShops(list); });
    return () => { cancelled = true; };
  }, [loadShopStates, state, session.shops.length]);

  const c = useMemo(() => (shops ? consolidate(shops, key) : null), [shops, key]);
  const stale = shops?.filter((s) => s.stale) ?? [];
  const max = c ? Math.max(1, ...c.ranking.map((r) => r.m.revenue)) : 1;

  const doc = c && (
    <article className="doc report">
      <header className="doc-head">
        <div><h1>Rapport général</h1><p>{c.rows.length} boutique(s) · {session.userName}</p></div>
        <div className="doc-meta"><h2>TOUTES LES BOUTIQUES</h2><p><strong>{c.label}</strong></p>
          <p>Édité le {new Date().toLocaleDateString('fr-FR')}</p></div>
      </header>
      <section><h3>Résultat du mois par boutique</h3><Comparison c={c} /></section>
      <section><h3>Situation à ce jour</h3><Situation c={c} /></section>
      {c.ranking.map((r) => <ShopDetail key={r.id} r={r} />)}
      <footer className="doc-foot"><p className="doc-brand">Rapport établi avec {APP_NAME} — chiffres estimés à partir des données saisies</p></footer>
    </article>
  );

  return (
    <>
      <PageHead title="Vue d'ensemble" sub={c ? `Toutes vos boutiques · ${c.label}` : 'Toutes vos boutiques'}>
        <input type="month" value={key} max={monthKeyOf(new Date())} aria-label="Mois"
          onChange={(e) => e.target.value && setKey(e.target.value)} />
        <button className="btn primary" disabled={!c} onClick={() => print(doc)}><Icon name="print" size={16} /> Rapport général (PDF)</button>
      </PageHead>

      {!c ? <div className="card"><p className="muted">Chargement des boutiques…</p></div> : (
        <>
          {stale.length > 0 && (
            <p className="note">Hors connexion : les chiffres de {stale.map((s) => s.name).join(', ')} datent de la dernière ouverture sur cet appareil.</p>
          )}
          {c.total && (
            <div className="stats">
              <div className="stat hero"><span>Chiffre d'affaires total</span><strong>{money(c.total.m.revenue, c.total.currency)}</strong>
                <small>{change(c.total.m.revenue, c.total.prev.revenue)} vs mois précédent</small></div>
              <div className="stat"><span>Marge estimée</span><strong>{money(c.total.m.margin, c.total.currency)}</strong>
                <small className="muted">{Math.round(c.total.m.marginRate * 100)} % du chiffre d'affaires</small></div>
              <div className="stat"><span>Bénéfice estimé</span><strong className={c.total.m.net < 0 ? 'neg' : ''}>{money(c.total.m.net, c.total.currency)}</strong>
                <small className="muted">après {money(c.total.m.expenses, c.total.currency)} de dépenses</small></div>
            </div>
          )}
          {!c.total && <p className="note">Vos boutiques n'utilisent pas la même devise : les totaux ne sont pas calculés.</p>}

          <section className="card">
            <h3>Classement des boutiques</h3>
            <ol className="rank">
              {c.ranking.map((r) => (
                <li key={r.id}>
                  <div className="rank-line">
                    <span><strong>{r.name}</strong>{r.id === session.currentShopId && <span className="badge ok">ouverte</span>}</span>
                    <span className="num">{money(r.m.revenue, r.currency)} · bénéfice {money(r.m.net, r.currency)}</span>
                  </div>
                  <div className="meter"><i style={{ width: `${(Math.max(0, r.m.revenue) / max) * 100}%` }} /></div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card"><h3>Résultat du mois par boutique</h3><div className="table-wrap"><Comparison c={c} /></div></section>
          <section className="card"><h3>Situation à ce jour</h3><div className="table-wrap"><Situation c={c} /></div></section>

          <section className="card">
            <h3>Ouvrir une boutique</h3>
            <div className="row">
              {c.rows.map((r) => (
                <button key={r.id} className="btn" disabled={r.id === session.currentShopId} onClick={() => auth.switchShop(r.id)}>
                  <Icon name="store" size={16} /> {r.name}
                </button>
              ))}
            </div>
            {c.rows.length < 2 && (
              <Empty icon="store" title="Une seule boutique pour l'instant">
                Ajoutez un autre point de vente dans Réglages → « Mes boutiques » pour comparer vos boutiques ici.
              </Empty>
            )}
          </section>
        </>
      )}
    </>
  );
}

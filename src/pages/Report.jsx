import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead } from '../ui.jsx';
import {
  monthRange, metrics, topProducts, expensesByCategory, customerBalance, stockValue,
  totalDebt, totalSupplierDebt, PAYMENTS,
} from '../lib/logic.js';
import { APP_NAME } from '../config.js';

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function useReport(state, key) {
  return useMemo(() => {
    const { start, end } = monthRange(key);
    const prev = monthRange(monthKey(new Date(start.getFullYear(), start.getMonth() - 1, 1)));
    return {
      label: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      m: metrics(state, start, end),
      prev: metrics(state, prev.start, prev.end),
      top: topProducts(state, start, end, 10),
      expenses: expensesByCategory(state, start, end),
      debts: state.customers.map((c) => [c.name, customerBalance(state, c.id)])
        .filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1]),
      stock: stockValue(state),
      debtTotal: totalDebt(state),
      supplierDebt: totalSupplierDebt(state),
      closings: state.closings.filter((c) => new Date(c.date) >= start && new Date(c.date) < end),
    };
  }, [state, key]);
}

// Corps du rapport, partagé entre l'écran et l'impression.
function ReportBody({ r, fmt }) {
  const { m, prev } = r;
  const change = (cur, old) => (old ? `${cur >= old ? '+' : ''}${Math.round(((cur - old) / Math.abs(old)) * 100)} %` : '—');
  const gap = r.closings.reduce((s, c) => s + c.diff, 0);
  return (
    <>
      <section>
        <h3>Résultat du mois</h3>
        <table>
          <thead><tr><th>Indicateur</th><th className="r">Ce mois</th><th className="r">Mois précédent</th><th className="r">Évolution</th></tr></thead>
          <tbody>
            {[
              ["Chiffre d'affaires", m.revenue, prev.revenue],
              ['Coût des marchandises vendues', m.cogs, prev.cogs],
              ['Marge estimée', m.margin, prev.margin],
              ['Dépenses saisies', m.expenses, prev.expenses],
              ['Bénéfice estimé', m.net, prev.net],
              ['Argent encaissé', m.cashIn, prev.cashIn],
              ['Achats fournisseurs', m.purchases, prev.purchases],
            ].map(([label, cur, old]) => (
              <tr key={label} className={label === 'Bénéfice estimé' ? 'strong' : ''}>
                <td>{label}</td><td className="r num">{fmt(cur)}</td><td className="r num">{fmt(old)}</td>
                <td className="r num">{change(cur, old)}</td>
              </tr>
            ))}
            <tr><td>Nombre de ventes</td><td className="r num">{m.salesCount}</td><td className="r num">{prev.salesCount}</td>
              <td className="r num">{change(m.salesCount, prev.salesCount)}</td></tr>
          </tbody>
        </table>
        <p className="muted small">
          Taux de marge : {Math.round(m.marginRate * 100)} % · Remises accordées : {fmt(m.discounts)} ·{' '}
          {Object.entries(m.byPayment).filter(([, v]) => v > 0).map(([k, v]) => `${PAYMENTS[k]} ${fmt(v)}`).join(' · ')}
        </p>
      </section>

      <section>
        <h3>Produits les plus vendus</h3>
        {r.top.length ? (
          <table>
            <thead><tr><th>Produit</th><th className="r">Quantité</th><th className="r">Chiffre</th><th className="r">Marge</th></tr></thead>
            <tbody>
              {r.top.map((t) => (
                <tr key={t.productId}><td>{t.name}</td><td className="r num">{t.qty}</td>
                  <td className="r num">{fmt(t.revenue)}</td><td className="r num">{fmt(t.margin)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">Aucune vente ce mois-là.</p>}
      </section>

      <section>
        <h3>Dépenses par catégorie</h3>
        {r.expenses.length ? (
          <table><tbody>
            {r.expenses.map(([c, v]) => <tr key={c}><td>{c}</td><td className="r num">{fmt(v)}</td></tr>)}
          </tbody></table>
        ) : <p className="muted">Aucune dépense saisie ce mois-là.</p>}
      </section>

      <section>
        <h3>Situation à ce jour</h3>
        <table><tbody>
          <tr><td>Valeur du stock au prix d'achat</td><td className="r num">{fmt(r.stock.cost)}</td></tr>
          <tr><td>Valeur du stock au prix de vente</td><td className="r num">{fmt(r.stock.retail)}</td></tr>
          <tr><td>Dettes clients à recouvrer</td><td className="r num">{fmt(r.debtTotal)}</td></tr>
          <tr><td>Dû aux fournisseurs</td><td className="r num">{fmt(r.supplierDebt)}</td></tr>
          <tr><td>Clôtures de caisse du mois</td><td className="r num">{r.closings.length} · écart cumulé {fmt(gap)}</td></tr>
        </tbody></table>
        {r.debts.length > 0 && (
          <p className="muted small">Principales dettes : {r.debts.slice(0, 8).map(([n, b]) => `${n} ${fmt(b)}`).join(' · ')}</p>
        )}
      </section>
    </>
  );
}

export default function Report() {
  const { state, fmt, print } = useStore();
  const [key, setKey] = useState(monthKey(new Date()));
  const r = useReport(state, key);

  const doc = (
    <article className="doc report">
      <header className="doc-head">
        <div><h1>{state.settings.shopName}</h1>{state.settings.address && <p>{state.settings.address}</p>}</div>
        <div className="doc-meta"><h2>RAPPORT MENSUEL</h2><p><strong>{r.label}</strong></p>
          <p>Édité le {new Date().toLocaleDateString('fr-FR')}</p></div>
      </header>
      <ReportBody r={r} fmt={fmt} />
      <footer className="doc-foot"><p className="doc-brand">Rapport établi avec {APP_NAME} — chiffres estimés à partir des données saisies</p></footer>
    </article>
  );

  return (
    <>
      <PageHead title="Rapport mensuel" sub={r.label}>
        <input type="month" value={key} max={monthKey(new Date())} aria-label="Mois"
          onChange={(e) => e.target.value && setKey(e.target.value)} />
        <button className="btn primary" onClick={() => print(doc)}><Icon name="print" size={16} /> Imprimer / PDF</button>
      </PageHead>
      <div className="card report-view"><ReportBody r={r} fmt={fmt} /></div>
      <p className="muted small">Pour obtenir un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</p>
    </>
  );
}

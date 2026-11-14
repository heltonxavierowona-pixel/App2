import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Tabs, Empty } from '../ui.jsx';
import {
  periodRange, metrics, topProducts, dailySeries, lowStock, totalDebt, stockValue, PAYMENTS,
} from '../lib/logic.js';
import { insights } from '../lib/insights.js';

const PERIODS = [['day', "Aujourd'hui"], ['week', 'Cette semaine'], ['month', 'Ce mois']];
const PREV_LABEL = { day: 'hier', week: 'la semaine dernière', month: 'le mois dernier' };

function Delta({ cur, prev, label }) {
  if (!prev) return <small className="muted">pas de comparaison</small>;
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const up = pct >= 0;
  return (
    <small className={up ? 'pos' : 'neg'}>
      <Icon name={up ? 'up' : 'down'} size={13} /> {up ? '+' : ''}{pct} % vs {label}
    </small>
  );
}

function BarChart({ series, fmt }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...series.map((d) => d.revenue));
  const W = 100 / series.length;
  const h = hover == null ? null : series[hover];
  return (
    <div className="chart">
      <div className="chart-tip" aria-live="polite">
        {h ? (
          <><strong>{fmt(h.revenue)}</strong> · {h.salesCount} vente(s) ·{' '}
            {h.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</>
        ) : <span className="muted">Survolez ou touchez une barre pour le détail</span>}
      </div>
      <div className="bars" onMouseLeave={() => setHover(null)}>
        {series.map((d, i) => (
          <button key={i} className={`bar-col${hover === i ? ' on' : ''}`} style={{ width: `${W}%` }}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}
            aria-label={`${d.date.toLocaleDateString('fr-FR')} : ${fmt(d.revenue)}`}>
            <span className="bar" style={{ height: `${Math.max(d.revenue > 0 ? 2 : 0, (d.revenue / max) * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="bar-axis">
        <span>{series[0].date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        <span>max {fmt(max)}</span>
        <span>aujourd'hui</span>
      </div>
    </div>
  );
}

export default function Dashboard({ go }) {
  const { state, fmt } = useStore();
  const [period, setPeriod] = useState('day');

  const data = useMemo(() => {
    const now = new Date();
    const r = periodRange(period, now);
    return {
      cur: metrics(state, r.start, r.end),
      prev: metrics(state, r.prevStart, r.prevEnd),
      top: topProducts(state, r.start, r.end, 5),
      series: dailySeries(state, period === 'month' ? 30 : 14, now),
      low: lowStock(state),
      debt: totalDebt(state),
      stock: stockValue(state),
      tips: insights(state, fmt, now).slice(0, 3),
    };
  }, [state, period, fmt]);
  const { cur, prev, top, series, low, debt, stock, tips } = data;

  if (!state.products.length)
    return (
      <>
        <PageHead title={state.settings.shopName} sub="Bienvenue dans COMMERCE AI" />
        <div className="card">
          <Empty icon="spark" title="Commencez en deux minutes">
            Ajoutez vos premiers produits, ou chargez des données de démonstration pour découvrir l'application.
          </Empty>
          <div className="row center">
            <button className="btn primary" onClick={() => go('products')}><Icon name="plus" size={16} /> Ajouter un produit</button>
            <button className="btn" onClick={() => go('settings')}>Charger la démo</button>
          </div>
        </div>
      </>
    );

  const payTotal = Object.values(cur.byPayment).reduce((a, b) => a + b, 0);
  const topMax = Math.max(1, ...top.map((t) => t.qty));

  return (
    <>
      <PageHead title={state.settings.shopName}
        sub={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
        <button className="btn primary" onClick={() => go('sales')}><Icon name="cart" size={16} /> Nouvelle vente</button>
      </PageHead>

      <Tabs value={period} onChange={setPeriod} options={PERIODS} />

      <div className="stats">
        <div className="stat hero">
          <span>Chiffre d'affaires</span>
          <strong>{fmt(cur.revenue)}</strong>
          <Delta cur={cur.revenue} prev={prev.revenue} label={PREV_LABEL[period]} />
        </div>
        <div className="stat">
          <span>Marge estimée</span>
          <strong>{fmt(cur.margin)}</strong>
          <small className="muted">{Math.round(cur.marginRate * 100)} % du chiffre d'affaires</small>
        </div>
        <div className="stat">
          <span>Dépenses saisies</span>
          <strong>{fmt(cur.expenses)}</strong>
          <Delta cur={-cur.expenses} prev={-prev.expenses} label={PREV_LABEL[period]} />
        </div>
        <div className="stat">
          <span>Bénéfice estimé</span>
          <strong className={cur.net < 0 ? 'neg' : ''}>{fmt(cur.net)}</strong>
          <small className="muted">marge − dépenses</small>
        </div>
        <div className="stat">
          <span>Ventes</span>
          <strong>{cur.salesCount}</strong>
          <small className="muted">{cur.units} article(s) · panier moyen {fmt(cur.salesCount ? cur.revenue / cur.salesCount : 0)}</small>
        </div>
        <div className="stat">
          <span>Argent encaissé</span>
          <strong>{fmt(cur.cashIn)}</strong>
          <small className="muted">{fmt(cur.creditGiven)} vendus à crédit</small>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Chiffre d'affaires par jour <small className="muted">· {series.length} derniers jours</small></h3>
          <BarChart series={series} fmt={fmt} />
        </section>

        <section className="card">
          <h3>Produits les plus vendus</h3>
          {top.length ? (
            <ol className="rank">
              {top.map((t) => (
                <li key={t.productId}>
                  <div className="rank-line">
                    <span>{t.name}</span>
                    <span className="num">{t.qty} vendu(s) · {fmt(t.revenue)}</span>
                  </div>
                  <div className="meter"><i style={{ width: `${(t.qty / topMax) * 100}%` }} /></div>
                </li>
              ))}
            </ol>
          ) : <p className="muted">Aucune vente sur cette période.</p>}
        </section>

        <section className="card">
          <h3>Modes de paiement</h3>
          {payTotal > 0 ? (
            <ul className="plain">
              {Object.entries(cur.byPayment).filter(([, v]) => v > 0).map(([k, v]) => (
                <li key={k} className="rank-line">
                  <span>{PAYMENTS[k]}</span>
                  <span className="num">{fmt(v)} · {Math.round((v / payTotal) * 100)} %</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Aucune vente sur cette période.</p>}
          <hr />
          <ul className="plain">
            <li className="rank-line"><span>Dettes clients à recouvrer</span>
              <button className="link num" onClick={() => go('customers')}>{fmt(debt)}</button></li>
            <li className="rank-line"><span>Valeur du stock (prix d'achat)</span><span className="num">{fmt(stock.cost)}</span></li>
            <li className="rank-line"><span>Valeur du stock (prix de vente)</span><span className="num">{fmt(stock.retail)}</span></li>
          </ul>
        </section>

        <section className="card">
          <h3>À réapprovisionner
            {low.length > 0 && <span className="badge warn">{low.length}</span>}</h3>
          {low.length ? (
            <ul className="plain">
              {low.slice(0, 6).map((p) => (
                <li key={p.id} className="rank-line">
                  <span>{p.name}</span>
                  <span className={`badge ${p.stock <= 0 ? 'crit' : 'warn'}`}>
                    {p.stock <= 0 ? 'Rupture' : `${p.stock} restant(s)`}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Tous les produits sont au-dessus de leur seuil minimum.</p>}
          <button className="link" onClick={() => go('stock')}>Gérer le stock →</button>
        </section>
      </div>

      {tips.length > 0 && (
        <section className="card">
          <h3><Icon name="spark" size={18} /> Conseils du jour</h3>
          <ul className="tips">
            {tips.map((t, i) => (
              <li key={i} className={`tip ${t.level}`}>
                <strong>{t.title}</strong>
                <p>{t.text}</p>
              </li>
            ))}
          </ul>
          <button className="link" onClick={() => go('insights')}>Voir tous les conseils →</button>
        </section>
      )}
    </>
  );
}

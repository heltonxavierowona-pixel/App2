import React, { useMemo } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Empty } from '../ui.jsx';
import { insights } from '../lib/insights.js';

const LEVELS = {
  critical: ['alert', 'Urgent'], warning: ['alert', 'À surveiller'],
  good: ['check', 'Bonne nouvelle'], info: ['info', 'Bon à savoir'],
};

export default function Insights({ go }) {
  const { state, fmt } = useStore();
  const list = useMemo(() => insights(state, fmt), [state, fmt]);

  return (
    <>
      <PageHead title="Conseils" sub="Analyse automatique de vos ventes, de votre stock et de vos dettes" />
      {!list.length ? (
        <div className="card">
          <Empty icon="spark" title="Rien à signaler">
            {state.sales.length
              ? 'Votre commerce est en ordre : pas de rupture, de dette ancienne ni de marge anormale.'
              : 'Les conseils apparaîtront dès que vous aurez enregistré des ventes.'}
          </Empty>
        </div>
      ) : (
        <ul className="tips big">
          {list.map((t, i) => (
            <li key={i} className={`tip ${t.level}`}>
              <span className="tip-tag"><Icon name={LEVELS[t.level][0]} size={14} /> {LEVELS[t.level][1]}</span>
              <strong>{t.title}</strong>
              <p>{t.text}</p>
              <button className="link" onClick={() => go(t.page)}>Ouvrir →</button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Ces conseils sont calculés à partir de vos données (rythme de vente sur 30 jours, seuils, marges, ancienneté des dettes).
        Ce sont des estimations pour vous aider à décider.
      </p>
    </>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { Icon } from './ui.jsx';
import { lowStock } from './lib/logic.js';
import Dashboard from './pages/Dashboard.jsx';
import Sales from './pages/Sales.jsx';
import Products from './pages/Products.jsx';
import Stock from './pages/Stock.jsx';
import Expenses from './pages/Expenses.jsx';
import Customers from './pages/Customers.jsx';
import Insights from './pages/Insights.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = [
  ['dashboard', 'Accueil', 'home', Dashboard],
  ['sales', 'Ventes', 'cart', Sales],
  ['products', 'Produits', 'box', Products],
  ['stock', 'Stock', 'layers', Stock],
  ['expenses', 'Dépenses', 'wallet', Expenses],
  ['customers', 'Clients', 'users', Customers],
  ['insights', 'Conseils', 'spark', Insights],
  ['settings', 'Réglages', 'settings', Settings],
];
const MOBILE_MAIN = ['dashboard', 'sales', 'products', 'customers'];

const pageFromHash = () => {
  const key = window.location.hash.slice(1);
  return PAGES.some(([k]) => k === key) ? key : 'dashboard';
};

export default function App() {
  const { state } = useStore();
  const [page, setPage] = useState(pageFromHash);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const onHash = () => { setPage(pageFromHash()); setMore(false); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (key) => {
    window.location.hash = key;
    setPage(key);
    setMore(false);
    window.scrollTo(0, 0);
  };

  const alerts = useMemo(() => lowStock(state).length, [state]);
  const Current = PAGES.find(([k]) => k === page)[3];
  const badge = (key) => (key === 'stock' && alerts > 0 ? <span className="dot">{alerts}</span> : null);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="logo">C</span><div>COMMERCE AI<small>{state.settings.shopName}</small></div></div>
        <nav>
          {PAGES.map(([key, label, icon]) => (
            <button key={key} className={page === key ? 'on' : ''} onClick={() => go(key)}
              aria-current={page === key ? 'page' : undefined}>
              <Icon name={icon} /> <span>{label}</span> {badge(key)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content"><Current go={go} /></main>

      <nav className="bottom-nav">
        {PAGES.filter(([k]) => MOBILE_MAIN.includes(k)).map(([key, label, icon]) => (
          <button key={key} className={page === key ? 'on' : ''} onClick={() => go(key)}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
        <button className={more || !MOBILE_MAIN.includes(page) ? 'on' : ''} onClick={() => setMore(!more)}
          aria-expanded={more}>
          <Icon name="more" /><span>Plus</span>{alerts > 0 && <span className="dot">{alerts}</span>}
        </button>
      </nav>

      {more && (
        <div className="sheet-overlay" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {PAGES.filter(([k]) => !MOBILE_MAIN.includes(k)).map(([key, label, icon]) => (
              <button key={key} className={page === key ? 'on' : ''} onClick={() => go(key)}>
                <Icon name={icon} /> <span>{label}</span> {badge(key)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

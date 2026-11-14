import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { Icon } from './ui.jsx';
import { lowStock } from './lib/logic.js';
import Logo from './components/Logo.jsx';
import { AuthScreen, NoShopScreen } from './components/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sales from './pages/Sales.jsx';
import Products from './pages/Products.jsx';
import Stock from './pages/Stock.jsx';
import Purchases from './pages/Purchases.jsx';
import Expenses from './pages/Expenses.jsx';
import Customers from './pages/Customers.jsx';
import Cashbox from './pages/Cashbox.jsx';
import Report from './pages/Report.jsx';
import Assistant from './pages/Assistant.jsx';
import Settings from './pages/Settings.jsx';

// clé, libellé, icône, écran, accessible au vendeur
const PAGES = [
  ['dashboard', 'Accueil', 'home', Dashboard, false],
  ['sales', 'Ventes', 'cart', Sales, true],
  ['products', 'Produits', 'box', Products, false],
  ['stock', 'Stock', 'layers', Stock, true],
  ['purchases', 'Achats', 'truck', Purchases, false],
  ['expenses', 'Dépenses', 'wallet', Expenses, false],
  ['customers', 'Clients', 'users', Customers, true],
  ['cashbox', 'Caisse', 'cash', Cashbox, true],
  ['report', 'Rapport', 'report', Report, false],
  ['assistant', 'Assistant', 'spark', Assistant, false],
  ['settings', 'Réglages', 'settings', Settings, true],
];
const MOBILE_MAIN = { owner: ['dashboard', 'sales', 'products', 'customers'], seller: ['sales', 'customers', 'cashbox', 'stock'] };
const SYNC_DOT = { synced: 'ok', syncing: 'busy', offline: 'off', error: 'off' };

export default function App() {
  const { boot, state, role, session, shop, auth, syncStatus, pendingCount } = useStore();
  const pages = useMemo(() => PAGES.filter((p) => role === 'owner' || p[4]), [role]);
  const home = pages[0][0];
  const fromHash = () => {
    const key = window.location.hash.slice(1);
    return pages.some(([k]) => k === key) ? key : home;
  };
  const [page, setPage] = useState(fromHash);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const onHash = () => { setPage(fromHash()); setMore(false); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!pages.some(([k]) => k === page)) setPage(home); }, [pages, page, home]);

  const alerts = useMemo(() => lowStock(state).length, [state]);

  if (boot === 'loading') return <div className="auth"><Logo size={34} stacked /></div>;
  if (boot === 'auth') return <AuthScreen />;
  if (boot === 'noshop') return <NoShopScreen />;

  const go = (key) => {
    window.location.hash = key;
    setPage(key);
    setMore(false);
    window.scrollTo(0, 0);
  };
  const Current = (pages.find(([k]) => k === page) ?? pages[0])[3];
  const badge = (key) => (key === 'stock' && alerts > 0 ? <span className="dot">{alerts}</span> : null);
  const main = MOBILE_MAIN[role] ?? MOBILE_MAIN.owner;
  const syncTitle = { synced: 'Synchronisé', syncing: 'Synchronisation…', offline: 'Hors connexion', error: 'Synchronisation impossible' }[syncStatus];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><Logo size={26} stacked /></div>
        {session.shops.length > 1 ? (
          <select className="shop-switch" value={shop.id} onChange={(e) => auth.switchShop(e.target.value)} aria-label="Boutique">
            {session.shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <div className="shop-name"><Icon name="store" size={16} /> {shop.name}</div>}
        <nav>
          {pages.map(([key, label, icon]) => (
            <button key={key} className={page === key ? 'on' : ''} onClick={() => go(key)}
              aria-current={page === key ? 'page' : undefined}>
              <Icon name={icon} /> <span>{label}</span> {badge(key)}
            </button>
          ))}
        </nav>
        {syncTitle && (
          <div className="sync"><i className={`sync-dot ${SYNC_DOT[syncStatus]}`} /> {syncTitle}{pendingCount > 0 && ` · ${pendingCount} en attente`}</div>
        )}
      </aside>

      <main className="content">
        <div className="topbar">
          <Logo size={22} />
          <span className="topbar-shop">{shop.name}{syncTitle && <i className={`sync-dot ${SYNC_DOT[syncStatus]}`} title={syncTitle} />}</span>
        </div>
        <Current go={go} />
      </main>

      <nav className="bottom-nav">
        {pages.filter(([k]) => main.includes(k)).map(([key, label, icon]) => (
          <button key={key} className={page === key ? 'on' : ''} onClick={() => go(key)}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
        <button className={more || !main.includes(page) ? 'on' : ''} onClick={() => setMore(!more)} aria-expanded={more}>
          <Icon name="more" /><span>Plus</span>{alerts > 0 && !main.includes('stock') && <span className="dot">{alerts}</span>}
        </button>
      </nav>

      {more && (
        <div className="sheet-overlay" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {pages.filter(([k]) => !main.includes(k)).map(([key, label, icon]) => (
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

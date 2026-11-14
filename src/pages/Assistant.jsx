import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Tabs, Empty } from '../ui.jsx';
import { insights } from '../lib/insights.js';
import { buildContext, localAnswer, SUGGESTIONS } from '../lib/assistant.js';
import { askAssistant } from '../lib/cloud.js';

const LEVELS = {
  critical: ['alert', 'Urgent'], warning: ['alert', 'À surveiller'],
  good: ['check', 'Bonne nouvelle'], info: ['info', 'Bon à savoir'],
};

function Tips({ go }) {
  const { state, fmt } = useStore();
  const list = useMemo(() => insights(state, fmt), [state, fmt]);
  if (!list.length)
    return (
      <div className="card">
        <Empty icon="spark" title="Rien à signaler">
          {state.sales.length
            ? 'Votre commerce est en ordre : pas de rupture, de dette ancienne ni de marge anormale.'
            : 'Les conseils apparaîtront dès que vous aurez enregistré des ventes.'}
        </Empty>
      </div>
    );
  return (
    <>
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
      <p className="muted small">Conseils calculés à partir de vos données : rythme de vente sur 30 jours, seuils, marges, ancienneté des dettes.</p>
    </>
  );
}

function Chat() {
  const { state, fmt, session, shop } = useStore();
  const [messages, setMessages] = useState([]); // { from: 'me' | 'ai', text, source }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [onlineOff, setOnlineOff] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages, busy]);

  const ask = async (question) => {
    question = question.trim();
    if (!question || busy) return;
    setInput('');
    setMessages((m) => [...m, { from: 'me', text: question }]);
    setBusy(true);
    let reply = null;
    if (session.mode === 'cloud' && !onlineOff && navigator.onLine) {
      try {
        reply = { text: await askAssistant(shop.id, question, buildContext(state)), source: 'Assistant en ligne' };
      } catch (e) {
        if (e.code === 'not_configured') setOnlineOff(true);
      }
    }
    if (!reply) {
      const text = localAnswer(question, state, fmt);
      reply = {
        source: 'Réponse calculée sur cet appareil',
        text: text ?? "Je n'ai pas compris cette question. Essayez par exemple : ventes de la semaine, meilleur produit du mois, produits à commander, dettes clients, dépenses du mois.",
      };
    }
    setMessages((m) => [...m, { from: 'ai', ...reply }]);
    setBusy(false);
  };

  return (
    <section className="card chat">
      <div className="chat-log" aria-live="polite">
        {!messages.length && (
          <div className="chat-empty">
            <p className="muted">Posez une question sur votre commerce, en français de tous les jours.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.from}`}>
            <p>{m.text}</p>
            {m.source && <small>{m.source}</small>}
          </div>
        ))}
        {busy && <div className="bubble ai"><p className="muted">Je regarde vos chiffres…</p></div>}
        <span ref={end} />
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Votre question…" aria-label="Votre question" />
        <button className="btn primary" type="submit" disabled={busy || !input.trim()}><Icon name="send" size={16} /> Envoyer</button>
      </form>
    </section>
  );
}

export default function Assistant({ go }) {
  const [tab, setTab] = useState('chat');
  return (
    <>
      <PageHead title="Assistant" sub="Posez vos questions et consultez les conseils automatiques" />
      <Tabs value={tab} onChange={setTab} options={[['chat', 'Questions'], ['tips', 'Conseils']]} />
      {tab === 'chat' ? <Chat /> : <Tips go={go} />}
    </>
  );
}

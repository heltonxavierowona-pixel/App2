import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Empty, Modal, Field, fmtDate, todayInput, fromInputDate } from '../ui.jsx';
import { addExpense, deleteExpense, EXPENSE_CATEGORIES, periodRange } from '../lib/logic.js';

function ExpenseForm({ onClose }) {
  const { run } = useStore();
  const [f, setF] = useState({ category: EXPENSE_CATEGORIES[0], amount: '', note: '', date: todayInput() });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (run(addExpense, { ...f, date: fromInputDate(f.date) }, 'Dépense enregistrée')) onClose();
  };
  return (
    <Modal title="Nouvelle dépense" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Montant"><input type="number" min="1" inputMode="numeric" required autoFocus value={f.amount} onChange={set('amount')} /></Field>
        <div className="form-grid">
          <Field label="Catégorie">
            <select value={f.category} onChange={set('category')}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" max={todayInput()} value={f.date} onChange={set('date')} /></Field>
        </div>
        <Field label="Note (facultatif)"><input value={f.note} onChange={set('note')} placeholder="ex. facture d'octobre" /></Field>
        <button className="btn primary big" type="submit">Enregistrer</button>
      </form>
    </Modal>
  );
}

export default function Expenses() {
  const { state, run, fmt } = useStore();
  const [open, setOpen] = useState(false);

  const { list, month, byCategory } = useMemo(() => {
    const r = periodRange('month');
    const inMonth = state.expenses.filter((e) => new Date(e.date) >= r.start && new Date(e.date) < r.end);
    const map = new Map();
    for (const e of inMonth) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return {
      list: [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)),
      month: inMonth.reduce((s, e) => s + e.amount, 0),
      byCategory: [...map.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [state.expenses]);
  const max = Math.max(1, ...byCategory.map(([, v]) => v));

  return (
    <>
      <PageHead title="Dépenses" sub={`${fmt(month)} dépensés ce mois-ci`}>
        <button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Nouvelle dépense</button>
      </PageHead>

      {!list.length ? (
        <div className="card"><Empty icon="wallet" title="Aucune dépense saisie">Loyer, transport, salaires, électricité… Saisissez vos dépenses pour connaître votre bénéfice réel.</Empty></div>
      ) : (
        <div className="grid-2">
          <section className="card">
            <h3>Ce mois-ci par catégorie</h3>
            {byCategory.length ? (
              <ol className="rank">
                {byCategory.map(([c, v]) => (
                  <li key={c}>
                    <div className="rank-line"><span>{c}</span><span className="num">{fmt(v)}</span></div>
                    <div className="meter"><i style={{ width: `${(v / max) * 100}%` }} /></div>
                  </li>
                ))}
              </ol>
            ) : <p className="muted">Aucune dépense ce mois-ci.</p>}
          </section>
          <section className="card">
            <h3>Historique</h3>
            <div className="table-wrap">
              <table>
                <tbody>
                  {list.slice(0, 100).map((e) => (
                    <tr key={e.id}>
                      <td><strong>{e.category}</strong><div className="muted">{fmtDate(e.date)}{e.note && ` · ${e.note}`}</div></td>
                      <td className="r num">{fmt(e.amount)}</td>
                      <td className="r">
                        <button className="icon-btn" aria-label="Supprimer la dépense"
                          onClick={() => window.confirm('Supprimer cette dépense ?') && run(deleteExpense, e.id, 'Dépense supprimée')}>
                          <Icon name="trash" size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {open && <ExpenseForm onClose={() => setOpen(false)} />}
    </>
  );
}

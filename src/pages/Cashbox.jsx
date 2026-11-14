import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Field, Empty, fmtDateTime } from '../ui.jsx';
import { addClosing, cashExpected } from '../lib/logic.js';

export default function Cashbox() {
  const { state, run, fmt } = useStore();
  const [f, setF] = useState({ counted: '', kept: '', note: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const b = useMemo(() => cashExpected(state), [state]);
  const last = state.closings.at(-1);
  const counted = f.counted === '' ? null : Number(f.counted);
  const diff = counted == null ? null : counted - b.expected;
  const history = useMemo(() => [...state.closings].reverse(), [state.closings]);

  const submit = (e) => {
    e.preventDefault();
    const message = diff === 0 ? 'Caisse clôturée : le compte est juste' : `Caisse clôturée : écart de ${fmt(diff)}`;
    if (run(addClosing, f, message)) setF({ counted: '', kept: '', note: '' });
  };

  const rows = [
    ['Fond de caisse au départ', b.opening],
    ['Ventes encaissées en espèces', b.sales],
    ['Dettes réglées en espèces', b.debtPayments],
    ['Remboursements de retours', -b.refunds],
    ['Dépenses payées en espèces', -b.expenses],
    ['Fournisseurs payés en espèces', -b.suppliers],
  ];

  return (
    <>
      <PageHead title="Clôture de caisse"
        sub={last ? `Dernière clôture : ${fmtDateTime(last.date)}` : 'Comparez les espèces comptées aux espèces attendues'} />

      <div className="grid-2">
        <section className="card">
          <h3>Espèces attendues</h3>
          <ul className="plain">
            {rows.filter(([, v], i) => i < 2 || v !== 0).map(([label, v]) => (
              <li key={label} className="rank-line">
                <span>{label}</span>
                <span className="num">{v < 0 ? '−' : ''}{fmt(Math.abs(v))}</span>
              </li>
            ))}
          </ul>
          <hr />
          <div className="total"><span>Doit être dans la caisse</span><strong>{fmt(b.expected)}</strong></div>
          <p className="muted small">
            Les paiements Mobile Money et carte ne sont pas comptés. Les acomptes des ventes à crédit sont considérés comme reçus en espèces.
          </p>
        </section>

        <section className="card">
          <h3>Compter la caisse</h3>
          <form onSubmit={submit}>
            <Field label="Espèces comptées">
              <input type="number" min="0" inputMode="numeric" required value={f.counted} onChange={set('counted')} />
            </Field>
            {diff != null && (
              <p className={`note ${diff === 0 ? 'good' : 'neg'}`}>
                {diff === 0 ? 'Le compte est juste.'
                  : diff > 0 ? `Excédent de ${fmt(diff)} : une vente n'a peut-être pas été saisie.`
                    : `Il manque ${fmt(-diff)} : vérifiez les dépenses non saisies ou les erreurs de monnaie.`}
              </p>
            )}
            <Field label="Fond de caisse laissé pour demain" hint="Le reste est retiré de la caisse (dépôt, coffre…)">
              <input type="number" min="0" inputMode="numeric" value={f.kept} onChange={set('kept')} placeholder="0" />
            </Field>
            <Field label="Note (facultatif)"><input value={f.note} onChange={set('note')} /></Field>
            <button className="btn primary big" type="submit"><Icon name="check" size={18} /> Clôturer la caisse</button>
          </form>
        </section>
      </div>

      <section className="card">
        <h3>Clôtures précédentes</h3>
        {!history.length ? (
          <Empty icon="cash" title="Aucune clôture">Clôturez la caisse chaque soir pour repérer tout de suite un écart.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th className="r">Attendu</th><th className="r">Compté</th><th className="r">Écart</th><th className="r">Retiré</th><th>Par</th></tr></thead>
              <tbody>
                {history.slice(0, 60).map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDateTime(c.date)}{c.note && <div className="muted">{c.note}</div>}</td>
                    <td className="r num">{fmt(c.expected)}</td>
                    <td className="r num">{fmt(c.counted)}</td>
                    <td className="r"><span className={`badge ${c.diff === 0 ? 'ok' : 'crit'}`}>{c.diff > 0 ? '+' : ''}{fmt(c.diff)}</span></td>
                    <td className="r num">{fmt(c.withdrawn)}</td>
                    <td>{c.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Icon, PageHead, Empty, Modal, Field, fmtDateTime, whatsappLink } from '../ui.jsx';
import { saveCustomer, deleteCustomer, addPayment, customerBalance, totalDebt, PAYMENTS } from '../lib/logic.js';

function CustomerForm({ customer, onClose }) {
  const { run } = useStore();
  const [f, setF] = useState(customer ?? { name: '', phone: '' });
  const submit = (e) => {
    e.preventDefault();
    if (run(saveCustomer, f, customer ? 'Client modifié' : 'Client ajouté')) onClose();
  };
  return (
    <Modal title={customer ? 'Modifier le client' : 'Nouveau client'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nom"><input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Téléphone" hint="Avec l'indicatif du pays, pour les rappels WhatsApp">
          <input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+237 6…" />
        </Field>
        <button className="btn primary big" type="submit">Enregistrer</button>
      </form>
    </Modal>
  );
}

function CustomerDetail({ customer, onClose, onEdit }) {
  const { state, run, fmt } = useStore();
  const balance = customerBalance(state, customer.id);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');

  const history = useMemo(() => {
    const saleIds = new Set(state.sales.filter((s) => s.customerId === customer.id).map((s) => s.id));
    return [
      ...state.sales.filter((s) => s.customerId === customer.id).map((s) => ({
        date: s.date, label: `Achat : ${s.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}`,
        detail: s.total > s.paid ? `${fmt(s.paid)} versés sur ${fmt(s.total)}` : s.payment === 'credit' ? 'Payé en totalité' : `Payé (${PAYMENTS[s.payment]})`,
        delta: s.total - s.paid,
      })),
      ...state.payments.filter((p) => p.customerId === customer.id).map((p) => ({
        date: p.date, label: 'Règlement', detail: PAYMENTS[p.method], delta: -p.amount,
      })),
      ...state.returns.filter((r) => saleIds.has(r.saleId)).map((r) => ({
        date: r.date, label: `Retour : ${r.qty} × ${r.name}`, detail: 'Déduit de la dette', delta: -r.creditedToDebt,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [state, customer.id, fmt]);

  const pay = (e) => {
    e.preventDefault();
    if (run(addPayment, { customerId: customer.id, amount, method }, 'Règlement enregistré')) setAmount('');
  };
  const reminder = `Bonjour ${customer.name}, petit rappel de ${state.settings.shopName} : il reste ${fmt(balance)} à régler sur votre compte. Merci !`;
  const remove = () =>
    window.confirm(`Supprimer le client « ${customer.name} » ?`) && run(deleteCustomer, customer.id, 'Client supprimé') && onClose();

  return (
    <Modal title={customer.name} onClose={onClose} wide>
      <div className="debt-box">
        <span>{balance > 0 ? 'Dette en cours' : 'Aucune dette'}</span>
        <strong className={balance > 0 ? 'neg' : 'pos'}>{fmt(Math.max(0, balance))}</strong>
        {customer.phone && <small className="muted">{customer.phone}</small>}
      </div>

      {balance > 0 && (
        <form onSubmit={pay} className="pay-form">
          <Field label="Encaisser un règlement">
            <input type="number" min="1" max={balance} inputMode="numeric" required value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder={`jusqu'à ${balance}`} />
          </Field>
          <Field label="Mode">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {Object.entries(PAYMENTS).filter(([k]) => k !== 'credit').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <button className="btn primary" type="submit">Encaisser</button>
        </form>
      )}

      <div className="row">
        {balance > 0 && (
          <a className="btn" target="_blank" rel="noreferrer" href={whatsappLink(customer.phone, reminder)}>
            <Icon name="send" size={16} /> Rappel WhatsApp
          </a>
        )}
        <button className="btn" onClick={onEdit}><Icon name="edit" size={16} /> Modifier</button>
        {!history.length && <button className="btn" onClick={remove}><Icon name="trash" size={16} /> Supprimer</button>}
      </div>

      <h3>Historique</h3>
      {history.length ? (
        <ul className="plain history">
          {history.map((h, i) => (
            <li key={i} className="rank-line">
              <div><strong>{h.label}</strong><div className="muted">{fmtDateTime(h.date)} · {h.detail}</div></div>
              {h.delta !== 0 && <span className={`num ${h.delta > 0 ? 'neg' : 'pos'}`}>{h.delta > 0 ? '+' : '−'}{fmt(Math.abs(h.delta))}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="muted">Aucun achat pour le moment.</p>}
    </Modal>
  );
}

export default function Customers() {
  const { state, fmt } = useStore();
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const rows = useMemo(
    () => state.customers
      .map((c) => ({ c, balance: customerBalance(state, c.id) }))
      .sort((a, b) => b.balance - a.balance || a.c.name.localeCompare(b.c.name)),
    [state],
  );
  const open = state.customers.find((c) => c.id === openId);

  return (
    <>
      <PageHead title="Clients & dettes" sub={`${fmt(totalDebt(state))} à recouvrer`}>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Nouveau client</button>
      </PageHead>

      {!rows.length ? (
        <div className="card"><Empty icon="users" title="Aucun client">Créez une fiche client pour vendre à crédit et suivre les règlements.</Empty></div>
      ) : (
        <section className="card">
          <ul className="plain list">
            {rows.map(({ c, balance }) => (
              <li key={c.id}>
                <button className="list-row" onClick={() => setOpenId(c.id)}>
                  <span className="avatar">{c.name.slice(0, 1).toUpperCase()}</span>
                  <span className="grow"><strong>{c.name}</strong><span className="muted">{c.phone || 'Pas de téléphone'}</span></span>
                  {balance > 0
                    ? <span className="badge crit">doit {fmt(balance)}</span>
                    : <span className="badge ok">à jour</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && !editing && <CustomerDetail customer={open} onClose={() => setOpenId(null)} onEdit={() => setEditing(open)} />}
      {editing && <CustomerForm customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

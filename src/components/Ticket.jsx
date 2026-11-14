import React from 'react';
import { PAYMENTS, fmtQty } from '../lib/logic.js';
import { APP_NAME } from '../config.js';
import Invoice from './Invoice.jsx';

// Ticket de caisse pour imprimante thermique 80 mm. En tête : le nom de la boutique
// enregistré à l'ouverture du compte.
export default function Ticket({ sale, state, fmt }) {
  const { shopName, phone, address } = state.settings;
  const customer = state.customers.find((c) => c.id === sale.customerId);
  return (
    <article className="ticket">
      <h1>{shopName}</h1>
      {address && <p className="c">{address}</p>}
      {phone && <p className="c">Tél. {phone}</p>}
      <hr />
      <p>Facture {sale.number}</p>
      <p>{new Date(sale.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}{sale.register && ` · ${sale.register}`}{sale.seller && ` · ${sale.seller}`}</p>
      {customer && <p>Client : {customer.name}</p>}
      <hr />
      {sale.items.map((i) => (
        <div key={i.id} className="t-line">
          <span>{i.name}</span>
          <span className="t-row"><span>{fmtQty(i.qty, i.unit)} × {fmt(i.price)}</span><span>{fmt(Math.round(i.qty * i.price))}</span></span>
        </div>
      ))}
      <hr />
      {sale.discount > 0 && <p className="t-row"><span>Remise</span><span>−{fmt(sale.discount)}</span></p>}
      <p className="t-row t-total"><span>TOTAL</span><span>{fmt(sale.total)}</span></p>
      <p className="t-row"><span>Paiement</span><span>{PAYMENTS[sale.payment]}</span></p>
      {sale.received != null && (
        <>
          <p className="t-row"><span>Reçu</span><span>{fmt(sale.received)}</span></p>
          <p className="t-row"><span>Rendu</span><span>{fmt(sale.change)}</span></p>
        </>
      )}
      {sale.total > sale.paid && (
        <>
          <p className="t-row"><span>Versé</span><span>{fmt(sale.paid)}</span></p>
          <p className="t-row"><span>Reste à payer</span><span>{fmt(sale.total - sale.paid)}</span></p>
        </>
      )}
      <hr />
      <p className="c">Merci pour votre achat !</p>
      <p className="c t-brand">{APP_NAME}</p>
    </article>
  );
}

// Document à imprimer selon le format choisi sur ce poste : ticket 80 mm ou facture A4.
export const saleDocument = (format, props) => (format === 'a4' ? <Invoice {...props} /> : <Ticket {...props} />);

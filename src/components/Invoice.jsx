import React from 'react';
import { PAYMENTS, returnedQty, fmtQty } from '../lib/logic.js';
import { APP_NAME } from '../config.js';

const dateLong = (d) => new Date(d).toLocaleString('fr-FR', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// Facture imprimable. L'en-tête porte le nom de la boutique enregistré à l'ouverture du compte.
export default function Invoice({ sale, state, fmt }) {
  const { shopName, phone, address } = state.settings;
  const customer = state.customers.find((c) => c.id === sale.customerId);
  const returned = state.returns.filter((r) => r.saleId === sale.id);
  const refund = returned.reduce((s, r) => s + r.amount, 0);
  return (
    <article className="doc invoice">
      <header className="doc-head">
        <div>
          <h1>{shopName}</h1>
          {address && <p>{address}</p>}
          {phone && <p>Tél. {phone}</p>}
        </div>
        <div className="doc-meta">
          <h2>FACTURE</h2>
          <p><strong>N° {sale.number}</strong></p>
          <p>{dateLong(sale.date)}</p>
        </div>
      </header>

      <section className="doc-parties">
        <div><span>Client</span><strong>{customer?.name ?? 'Client comptant'}</strong>{customer?.phone && <p>{customer.phone}</p>}</div>
        {sale.seller && <div><span>Vendeur</span><strong>{sale.seller}</strong></div>}
      </section>

      <table>
        <thead><tr><th>Désignation</th><th className="r">Qté</th><th className="r">Prix unitaire</th><th className="r">Montant</th></tr></thead>
        <tbody>
          {sale.items.map((i) => {
            const back = returnedQty(state, sale.id, i.id);
            return (
              <tr key={i.id}>
                <td>{i.name}{back > 0 && <em> — {back} retourné(s)</em>}</td>
                <td className="r">{fmtQty(i.qty, i.unit)}</td>
                <td className="r">{fmt(i.price)}</td>
                <td className="r">{fmt(Math.round(i.qty * i.price))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <dl className="doc-totals">
        {sale.discount > 0 && <><dt>Sous-total</dt><dd>{fmt(sale.subtotal)}</dd><dt>Remise</dt><dd>−{fmt(sale.discount)}</dd></>}
        <dt className="grand">Total</dt><dd className="grand">{fmt(sale.total)}</dd>
        <dt>Mode de paiement</dt><dd>{PAYMENTS[sale.payment]}</dd>
        {sale.received != null && <><dt>Reçu</dt><dd>{fmt(sale.received)}</dd><dt>Rendu</dt><dd>{fmt(sale.change)}</dd></>}
        {sale.total > sale.paid && <><dt>Versé</dt><dd>{fmt(sale.paid)}</dd><dt>Reste à payer</dt><dd>{fmt(sale.total - sale.paid)}</dd></>}
        {refund > 0 && <><dt>Retours</dt><dd>−{fmt(refund)}</dd></>}
      </dl>

      <footer className="doc-foot">
        <p>Merci pour votre achat.</p>
        <p className="doc-brand">Facture émise avec {APP_NAME}</p>
      </footer>
    </article>
  );
}

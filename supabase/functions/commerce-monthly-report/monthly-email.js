// Rapports mensuels envoyés par e-mail : un rapport par boutique pour ses gérants,
// et un rapport général (toutes ses boutiques) pour chaque patron. Module pur.
import { consolidate, money } from './overview.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const td = 'padding:8px 10px;border-top:1px solid #d9dedb;';
const num = `${td}text-align:right;white-space:nowrap;`;
const change = (cur, old) => (old ? `${cur >= old ? '+' : ''}${Math.round(((cur - old) / Math.abs(old)) * 100)} %` : '—');

function shopBlock(r) {
  const f = (n) => esc(money(n, r.currency));
  const line = (label, cur, old) =>
    `<tr><td style="${td}">${label}</td><td style="${num}">${f(cur)}</td><td style="${num}">${change(cur, old)}</td></tr>`;
  const top = r.top.length
    ? `<p style="margin:14px 0 4px"><strong>Produits les plus vendus</strong></p><table style="border-collapse:collapse;width:100%">${
      r.top.map((t) => `<tr><td style="${td}">${esc(t.name)}</td><td style="${num}">${t.qty} vendu(s)</td><td style="${num}">${f(t.revenue)}</td></tr>`).join('')}</table>`
    : '';
  const expenses = r.expenses.length
    ? `<p style="margin:14px 0 4px"><strong>Dépenses</strong> : ${r.expenses.map(([c, v]) => `${esc(c)} ${f(v)}`).join(' · ')}</p>`
    : '';
  return `<h2 style="font-size:17px;margin:26px 0 8px;color:#0b5f4a">${esc(r.name)}</h2>
<table style="border-collapse:collapse;width:100%">
<tr><th style="text-align:left;padding:6px 10px">Indicateur</th><th style="text-align:right;padding:6px 10px">Mois</th><th style="text-align:right;padding:6px 10px">Évolution</th></tr>
${line("Chiffre d'affaires", r.m.revenue, r.prev.revenue)}
${line('Marge estimée', r.m.margin, r.prev.margin)}
${line('Dépenses saisies', r.m.expenses, r.prev.expenses)}
${line('Bénéfice estimé', r.m.net, r.prev.net)}
<tr><td style="${td}">Nombre de ventes</td><td style="${num}">${r.m.salesCount}</td><td style="${num}">${change(r.m.salesCount, r.prev.salesCount)}</td></tr>
</table>${top}${expenses}
<p style="margin:14px 0 0;color:#5c6b66">Stock : ${f(r.stock.cost)} au prix d'achat · ${r.outCount} produit(s) en rupture, ${r.lowCount} sous le seuil ·
Dettes clients : ${f(r.debt)} · Dû aux fournisseurs : ${f(r.supplierDebt)} · Écart de caisse cumulé : ${f(r.closingGap)}</p>`;
}

function page(title, label, body) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#14201c;max-width:640px;margin:0 auto;padding:8px">
<p style="letter-spacing:.14em;font-size:12px;color:#5c6b66;margin:0">NUMERA COMMERCIAL AI</p>
<h1 style="font-size:22px;margin:6px 0 2px">${esc(title)}</h1>
<p style="margin:0 0 6px;color:#5c6b66">Rapport de ${esc(label)}</p>
${body}
<p style="margin-top:28px;font-size:12px;color:#5c6b66">Chiffres estimés à partir des données saisies dans NUMERA COMMERCIAL AI.</p></div>`;
}

function generalBlock(c) {
  const f = (n) => esc(money(n, c.total.currency));
  const rows = c.ranking.map((r, i) =>
    `<tr><td style="${td}">${i + 1}. ${esc(r.name)}</td><td style="${num}">${f(r.m.revenue)}</td><td style="${num}">${f(r.m.margin)}</td><td style="${num}">${f(r.m.expenses)}</td><td style="${num}">${f(r.m.net)}</td></tr>`).join('');
  const t = c.total;
  return `<h2 style="font-size:17px;margin:22px 0 8px;color:#0b5f4a">Ensemble des boutiques</h2>
<table style="border-collapse:collapse;width:100%">
<tr><th style="text-align:left;padding:6px 10px">Boutique</th><th style="text-align:right;padding:6px 10px">Chiffre</th><th style="text-align:right;padding:6px 10px">Marge</th><th style="text-align:right;padding:6px 10px">Dépenses</th><th style="text-align:right;padding:6px 10px">Bénéfice</th></tr>
${rows}
<tr style="font-weight:bold"><td style="${td}">Total</td><td style="${num}">${f(t.m.revenue)}</td><td style="${num}">${f(t.m.margin)}</td><td style="${num}">${f(t.m.expenses)}</td><td style="${num}">${f(t.m.net)}</td></tr>
</table>
<p style="margin:10px 0 0;color:#5c6b66">Chiffre d'affaires total : ${change(t.m.revenue, t.prev.revenue)} par rapport au mois précédent ·
Dettes clients : ${f(t.debt)} · Dû aux fournisseurs : ${f(t.supplierDebt)} · ${t.outCount} produit(s) en rupture</p>`;
}

// shops : [{ id, name, currency, state, owners: [e-mail], managers: [e-mail] }]
// → [{ to, scope, subject, html }] ; scope = identifiant de boutique, ou 'general'.
export function buildEmails(shops, key, offsetHours = null) {
  const emails = [];
  const all = consolidate(shops, key, offsetHours);
  const byId = new Map(all.rows.map((r) => [r.id, r]));

  for (const shop of shops)
    for (const to of shop.managers ?? [])
      emails.push({
        to, scope: shop.id,
        subject: `${shop.name} — rapport de ${all.label}`,
        html: page(shop.name, all.label, shopBlock(byId.get(shop.id))),
      });

  const owners = [...new Set(shops.flatMap((s) => s.owners ?? []))];
  for (const to of owners) {
    const mine = shops.filter((s) => (s.owners ?? []).includes(to));
    const c = consolidate(mine, key, offsetHours);
    const body = (c.total && mine.length > 1 ? generalBlock(c) : '') + c.ranking.map(shopBlock).join('');
    emails.push({
      to, scope: 'general',
      subject: mine.length > 1 ? `Rapport général de ${c.label} — ${mine.length} boutiques` : `${mine[0].name} — rapport de ${c.label}`,
      html: page(mine.length > 1 ? 'Rapport général' : mine[0].name, c.label, body),
    });
  }
  return emails;
}

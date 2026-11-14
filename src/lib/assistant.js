// Assistant : résumé chiffré de la boutique (envoyé au modèle en ligne) et réponses locales
// par mots-clés quand l'assistant en ligne n'est pas disponible.
import {
  periodRange, metrics, topProducts, lowStock, customerBalance, expensesByCategory,
  stockValue, totalDebt, totalSupplierDebt, supplierBalance, cashExpected, registersOf, registerLabel,
} from './logic.js';
import { insights, velocities } from './insights.js';

const round = (n) => Math.round(n);
const pick = (m) => ({
  chiffre_affaires: round(m.revenue), marge: round(m.margin), depenses: round(m.expenses),
  benefice: round(m.net), ventes: m.salesCount, articles: m.units, encaisse: round(m.cashIn),
  vendu_a_credit: round(m.creditGiven), achats_fournisseurs: round(m.purchases),
});

// Résumé compact des données, sans noms de clients inutiles au-delà des dettes.
export function buildContext(state, now = new Date()) {
  const periods = {};
  for (const [key, label] of [['day', 'aujourd_hui'], ['week', 'cette_semaine'], ['month', 'ce_mois']]) {
    const r = periodRange(key, now);
    periods[label] = pick(metrics(state, r.start, r.end));
    periods[`${label}_periode_precedente`] = pick(metrics(state, r.prevStart, r.prevEnd));
  }
  const month = periodRange('month', now);
  const vel = new Map(velocities(state, now).map((v) => [v.product.id, v]));
  return {
    boutique: state.settings.shopName,
    devise: state.settings.currency,
    date: now.toISOString().slice(0, 10),
    periodes: periods,
    meilleures_ventes_du_mois: topProducts(state, month.start, month.end, 10)
      .map((t) => ({ produit: t.name, quantite: t.qty, chiffre: round(t.revenue), marge: round(t.margin) })),
    depenses_du_mois_par_categorie: Object.fromEntries(expensesByCategory(state, month.start, month.end)),
    produits: state.products.filter((p) => !p.archived).slice(0, 150).map((p) => {
      const v = vel.get(p.id);
      return {
        nom: p.name, categorie: p.category, achat: p.cost, vente: p.price, stock: p.stock, seuil: p.minStock,
        ventes_par_semaine: v ? Number((v.perDay * 7).toFixed(1)) : 0,
        jours_de_stock: v && Number.isFinite(v.daysLeft) ? round(v.daysLeft) : null,
      };
    }),
    valeur_du_stock: stockValue(state),
    dettes_clients_total: round(totalDebt(state)),
    dettes_clients: state.customers.map((c) => ({ client: c.name, doit: round(customerBalance(state, c.id)) }))
      .filter((c) => c.doit > 0).sort((a, b) => b.doit - a.doit).slice(0, 30),
    dettes_fournisseurs_total: round(totalSupplierDebt(state)),
    dettes_fournisseurs: state.suppliers.map((s) => ({ fournisseur: s.name, du: round(supplierBalance(state, s.id)) }))
      .filter((s) => s.du > 0),
    especes_attendues_par_caisse: Object.fromEntries(
      (registersOf(state).length ? registersOf(state) : ['']).map((r) => [registerLabel(r), round(cashExpected(state, now, r).expected)])),
  };
}

const has = (q, ...words) => words.some((w) => q.includes(w));

// Réponse locale : reconnaît les questions courantes. Renvoie null si la question n'est pas comprise.
export function localAnswer(question, state, fmt, now = new Date()) {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const period = has(q, 'mois') ? 'month' : has(q, 'semaine') ? 'week' : has(q, 'hier') ? 'yesterday' : 'day';
  const label = { day: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois-ci', yesterday: 'Hier' }[period];
  const r = period === 'yesterday'
    ? (({ prevStart, prevEnd }) => ({ start: prevStart, end: prevEnd }))(periodRange('day', now))
    : periodRange(period, now);
  const m = metrics(state, r.start, r.end);

  if (has(q, 'rupture', 'reapprovision', 'commander', 'manque', 'stock')) {
    const low = lowStock(state);
    if (!low.length) return 'Tous vos produits sont au-dessus de leur seuil minimum.';
    const vel = new Map(velocities(state, now).map((v) => [v.product.id, v]));
    return `${low.length} produit(s) à réapprovisionner :\n` + low.slice(0, 10).map((p) => {
      const order = vel.get(p.id)?.suggestedOrder;
      return `• ${p.name} : ${p.stock} en stock (seuil ${p.minStock})${order ? `, commander environ ${order}` : ''}`;
    }).join('\n');
  }
  if (has(q, 'fournisseur')) {
    const rows = state.suppliers.map((s) => [s.name, supplierBalance(state, s.id)]).filter(([, b]) => b > 0);
    return rows.length
      ? `Vous devez ${fmt(totalSupplierDebt(state))} à vos fournisseurs :\n` + rows.map(([n, b]) => `• ${n} : ${fmt(b)}`).join('\n')
      : 'Vous ne devez rien à vos fournisseurs.';
  }
  if (has(q, 'dette', 'doit', 'doivent', 'credit', 'impaye')) {
    const rows = state.customers.map((c) => [c.name, customerBalance(state, c.id)])
      .filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1]);
    return rows.length
      ? `Vos clients vous doivent ${fmt(totalDebt(state))} :\n` + rows.slice(0, 10).map(([n, b]) => `• ${n} : ${fmt(b)}`).join('\n')
      : 'Aucun client ne vous doit d\'argent.';
  }
  if (has(q, 'meilleur', 'plus vendu', 'rapporte', 'top', 'marche le mieux')) {
    const range = period === 'day' ? periodRange('month', now) : r;
    const top = topProducts(state, range.start, range.end, 5);
    if (!top.length) return 'Aucune vente sur cette période.';
    const byMargin = [...top].sort((a, b) => b.margin - a.margin)[0];
    return `${period === 'day' ? 'Ce mois-ci' : label}, vos meilleures ventes :\n` +
      top.map((t) => `• ${t.name} : ${t.qty} vendu(s), ${fmt(t.revenue)} de chiffre, ${fmt(t.margin)} de marge`).join('\n') +
      `\nLe produit qui rapporte le plus de marge : ${byMargin.name}.`;
  }
  if (has(q, 'depense', 'charge', 'frais')) {
    const range = period === 'day' ? periodRange('month', now) : r;
    const rows = expensesByCategory(state, range.start, range.end);
    const total = rows.reduce((s, [, v]) => s + v, 0);
    return rows.length
      ? `${period === 'day' ? 'Ce mois-ci' : label}, ${fmt(total)} de dépenses :\n` + rows.map(([c, v]) => `• ${c} : ${fmt(v)}`).join('\n')
      : 'Aucune dépense saisie sur cette période.';
  }
  if (has(q, 'caisse', 'espece', 'tiroir'))
    return 'Espèces attendues depuis la dernière clôture :\n' + (registersOf(state).length ? registersOf(state) : [''])
      .map((r) => `• ${registerLabel(r)} : ${fmt(cashExpected(state, now, r).expected)}`).join('\n');
  if (has(q, 'conseil', 'ameliorer', 'faire quoi', 'recommand')) {
    const tips = insights(state, fmt, now).slice(0, 4);
    return tips.length ? tips.map((t) => `• ${t.title} — ${t.text}`).join('\n') : 'Rien à signaler pour le moment.';
  }
  if (has(q, 'vente', 'vendu', 'chiffre', 'recette', 'marge', 'benefice', 'gagne', 'combien', 'bilan', 'resume'))
    return `${label} : ${m.salesCount} vente(s) pour ${fmt(m.revenue)} de chiffre d'affaires. ` +
      `Marge estimée ${fmt(m.margin)} (${Math.round(m.marginRate * 100)} %), dépenses ${fmt(m.expenses)}, ` +
      `bénéfice estimé ${fmt(m.net)}. Argent encaissé : ${fmt(m.cashIn)}.`;
  return null;
}

export const SUGGESTIONS = [
  'Combien ai-je gagné cette semaine ?',
  'Quel produit me rapporte le plus ce mois-ci ?',
  'Que dois-je commander ?',
  'Qui me doit de l\'argent ?',
  'Où part mon argent ce mois-ci ?',
];

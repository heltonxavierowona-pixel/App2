// Conseils automatiques : des règles simples calculées sur les données du commerce.
// Chaque conseil : { level: 'critical' | 'warning' | 'info' | 'good', title, text, page }
import {
  addDays, startOfDay, metrics, periodRange, customerBalance,
} from './logic.js';

const DAY = 86400000;

// Vitesse de vente par produit (unités/jour) sur les `window` derniers jours.
export function velocities(state, now = new Date(), window = 30) {
  const since = addDays(startOfDay(now), -window).getTime();
  const sold = new Map();
  const lastSale = new Map();
  for (const s of state.sales) {
    const t = new Date(s.date).getTime();
    for (const i of s.items) {
      if (t >= since) sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.qty);
      if (t > (lastSale.get(i.productId) ?? 0)) lastSale.set(i.productId, t);
    }
  }
  for (const r of state.returns)
    if (new Date(r.date).getTime() >= since)
      sold.set(r.productId, (sold.get(r.productId) ?? 0) - r.qty);
  return state.products.filter((p) => !p.archived).map((p) => {
    // Un produit récent n'est mesuré que depuis sa création (7 jours minimum).
    const age = Math.max(7, Math.min(window, (now - new Date(p.createdAt)) / DAY));
    const perDay = Math.max(0, sold.get(p.id) ?? 0) / age;
    return {
      product: p,
      perDay,
      daysLeft: perDay > 0 ? p.stock / perDay : Infinity,
      suggestedOrder: Math.max(0, Math.ceil(perDay * 30 - p.stock)),
      lastSale: lastSale.get(p.id) ?? null,
    };
  });
}

export function insights(state, fmt, now = new Date()) {
  const out = [];
  const vel = velocities(state, now);

  // 1. Ruptures et réapprovisionnement
  for (const v of vel) {
    const p = v.product;
    if (p.stock <= 0 && v.perDay > 0) {
      out.push({
        level: 'critical', page: 'stock',
        title: `Rupture : ${p.name}`,
        text: `Ce produit se vend environ ${(v.perDay * 7).toFixed(1)} fois par semaine et il n'y en a plus. Commandez environ ${v.suggestedOrder} unités pour tenir un mois.`,
      });
    } else if (v.daysLeft <= 7) {
      out.push({
        level: 'warning', page: 'stock',
        title: `${p.name} : rupture prévue dans ${Math.max(1, Math.round(v.daysLeft))} j`,
        text: `Il reste ${p.stock} unités pour un rythme d'environ ${(v.perDay * 7).toFixed(1)} ventes par semaine. Quantité conseillée à commander : ${v.suggestedOrder}.`,
      });
    } else if (p.stock <= p.minStock) {
      out.push({
        level: 'warning', page: 'stock',
        title: `${p.name} sous le seuil minimum`,
        text: `Stock : ${p.stock} (seuil : ${p.minStock}).${v.suggestedOrder ? ` Quantité conseillée : ${v.suggestedOrder}.` : ''}`,
      });
    }
  }

  // 2. Stock dormant (argent immobilisé)
  const dormant = vel.filter((v) => {
    const p = v.product;
    const old = now - new Date(p.createdAt) > 30 * DAY;
    return p.stock > 0 && old && (!v.lastSale || now - v.lastSale > 30 * DAY);
  });
  if (dormant.length) {
    const value = dormant.reduce((s, v) => s + v.product.stock * v.product.cost, 0);
    const names = dormant.slice(0, 3).map((v) => v.product.name).join(', ');
    out.push({
      level: 'info', page: 'products',
      title: `${dormant.length} produit(s) sans vente depuis 30 jours`,
      text: `${fmt(value)} sont immobilisés dans ce stock (${names}${dormant.length > 3 ? '…' : ''}). Une promotion ou une remise peut aider à l'écouler.`,
    });
  }

  // 3. Marges faibles ou négatives
  for (const p of state.products) {
    if (p.archived || p.price <= 0) continue;
    const rate = (p.price - p.cost) / p.price;
    if (p.price <= p.cost)
      out.push({
        level: 'critical', page: 'products',
        title: `${p.name} est vendu à perte`,
        text: `Prix de vente ${fmt(p.price)} pour un prix d'achat de ${fmt(p.cost)}. Revoyez le prix de vente.`,
      });
    else if (rate < 0.1)
      out.push({
        level: 'warning', page: 'products',
        title: `Marge très faible sur ${p.name}`,
        text: `Seulement ${Math.round(rate * 100)} % de marge (${fmt(p.price - p.cost)} par unité).`,
      });
  }

  // 4. Dettes anciennes
  for (const c of state.customers) {
    const balance = customerBalance(state, c.id);
    if (balance <= 0) continue;
    const dates = [
      ...state.sales.filter((s) => s.customerId === c.id).map((s) => s.date),
      ...state.payments.filter((p) => p.customerId === c.id).map((p) => p.date),
    ].map((d) => new Date(d).getTime());
    const days = Math.floor((now - Math.max(...dates)) / DAY);
    if (days >= 14)
      out.push({
        level: days >= 30 ? 'critical' : 'warning', page: 'customers',
        title: `${c.name} doit ${fmt(balance)}`,
        text: `Aucun mouvement sur ce compte depuis ${days} jours. Pensez à le relancer.`,
      });
  }

  // 5. Tendance et poids des dépenses
  const w = periodRange('week', now);
  // Comparaison à durée égale : même nombre de jours écoulés la semaine précédente.
  const elapsed = now - w.start;
  const cur = metrics(state, w.start, w.end);
  const prev = metrics(state, w.prevStart, new Date(w.prevStart.getTime() + elapsed));
  if (prev.revenue > 0 && cur.revenue > 0) {
    const change = (cur.revenue - prev.revenue) / prev.revenue;
    if (Math.abs(change) >= 0.15)
      out.push({
        level: change > 0 ? 'good' : 'warning', page: 'dashboard',
        title: `Ventes ${change > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(Math.round(change * 100))} % cette semaine`,
        text: `${fmt(cur.revenue)} contre ${fmt(prev.revenue)} à la même période la semaine dernière.`,
      });
  }
  const mo = periodRange('month', now);
  const month = metrics(state, mo.start, mo.end);
  if (month.margin > 0 && month.expenses > month.margin * 0.6)
    out.push({
      level: month.expenses > month.margin ? 'critical' : 'warning', page: 'expenses',
      title: 'Les dépenses pèsent lourd ce mois-ci',
      text: `${fmt(month.expenses)} de dépenses pour ${fmt(month.margin)} de marge : il reste ${fmt(month.net)} de bénéfice estimé.`,
    });

  // 6. Meilleur jour de la semaine (sur 8 semaines)
  const byDay = Array(7).fill(0);
  const since = addDays(startOfDay(now), -56).getTime();
  for (const s of state.sales) {
    const d = new Date(s.date);
    if (d.getTime() >= since) byDay[d.getDay()] += s.total;
  }
  const total = byDay.reduce((a, b) => a + b, 0);
  const best = byDay.indexOf(Math.max(...byDay));
  if (total > 0 && byDay[best] > (total / 7) * 1.4) {
    const names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    out.push({
      level: 'info', page: 'dashboard',
      title: `Votre meilleur jour : le ${names[best]}`,
      text: `Il représente ${Math.round((byDay[best] / total) * 100)} % de vos ventes. Assurez-vous d'avoir assez de stock ce jour-là.`,
    });
  }

  const order = { critical: 0, warning: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

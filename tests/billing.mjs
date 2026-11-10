// Offres, limites et circuit de paiement, sur une pile Supabase locale (npx supabase start).
// Le rôle « propriétaire de la plateforme » et l'expiration sont posés directement en base avec psql.
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const key = process.env.SUPABASE_ANON_KEY
const db = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
if (!key) throw new Error('SUPABASE_ANON_KEY manquant (clé publishable affichée par « supabase status »).')

const sql = (q) => execFileSync('psql', [db, '-Atqc', q], { encoding: 'utf8' }).trim()
const mk = () => createClient(url, key, { auth: { persistSession: false } })
const ok = (c, m) => {
  console.log(c ? 'PASS' : 'FAIL', m)
  if (!c) process.exitCode = 1
}
// Base de test uniquement : on repart sans lien enregistré par un passage précédent.
sql('delete from public.plan_links')
const t = Date.now()
const REF = `MP${t}.A56789` // référence unique : le test peut être relancé sur la même base
const signUp = async (name) => {
  const c = mk()
  const { data } = await c.auth.signUp({ email: `${name}${t}@numera.test`, password: 'motdepasse1' })
  return [c, data.user.id]
}

const [A] = await signUp('pa')
const [B] = await signUp('pb')
const [P, idP] = await signUp('owner')
const { data: orgA } = await A.rpc('create_organization', { p_name: 'Client A', p_country: 'Cameroun', p_currency: 'XAF', p_with_demo: true })
const { data: orgB } = await B.rpc('create_organization', { p_name: 'Client B', p_country: 'Togo', p_currency: 'XOF' })
await P.rpc('create_organization', { p_name: 'NUMERA', p_country: 'Cameroun', p_currency: 'XAF' })
sql(`insert into public.platform_admins (user_id) values ('${idP}')`)

let o = (await A.rpc('billing_overview')).data
ok(o.state === 'trial' && o.plan_id === 'pme' && o.plans.length === 3, `nouvelle entreprise en essai PME (${o.state}, ${o.plan_id})`)
ok(o.usage.active_shipments === 5 && o.usage.members === 1, 'usage compté : 5 expéditions en cours, 1 utilisateur')
ok(!o.is_platform_admin && (await P.rpc('billing_overview')).data.is_platform_admin, 'seul le propriétaire est reconnu comme tel')

// --- Ce qu'une entreprise ne peut pas faire seule
ok((await B.rpc('admin_overview')).error?.code === '42501', 'un client n’accède pas à l’écran Plateforme')
ok((await B.rpc('admin_set_plan_link', { p_plan: 'pme', p_interval: 'month', p_url: 'https://pirate.example/x' })).error, 'un client ne peut pas enregistrer de lien')
const up = await B.from('subscriptions').update({ status: 'active', current_period_end: '2099-01-01' }).eq('organization_id', orgB).select()
ok(!up.data?.length, 'un client ne peut pas activer son abonnement lui-même')
ok((await B.from('payments').insert({ organization_id: orgB, amount: 1, reference: 'faux' })).error, 'un client ne peut pas créer de paiement')
ok((await B.from('platform_admins').select('*')).data?.length === 0, 'la liste des propriétaires n’est pas lisible')
ok((await B.from('plan_links').select('*')).data?.length === 0, 'les liens ne sont pas lisibles directement')
ok((await B.from('subscriptions').select('*')).data?.length === 1, 'un client ne voit que son abonnement')

// --- Circuit de paiement
ok((await A.rpc('request_subscription', { p_plan: 'decouverte', p_interval: 'month', p_name: 'Awa', p_phone: '+237612345678' })).error, 'l’offre gratuite ne se paie pas')
ok((await A.rpc('request_subscription', { p_plan: 'pme', p_interval: 'month', p_name: 'Awa', p_phone: '12' })).error, 'téléphone exigé')
const req = await A.rpc('request_subscription', { p_plan: 'pme', p_interval: 'month', p_name: 'Awa Ndiaye', p_phone: '+237 6 12 34 56 78' })
o = (await A.rpc('billing_overview')).data
ok(req.data && o.request.status === 'awaiting_link' && Number(o.request.amount) === 15000, 'demande créée, en attente de lien, 15 000 FCFA')
ok((await A.rpc('submit_payment_reference', { p_request: req.data, p_ref: 'TX0001' })).error, 'pas de référence avant le lien')
const sent = await P.rpc('admin_set_plan_link', { p_plan: 'pme', p_interval: 'month', p_url: 'https://pay.example/pme-mois' })
o = (await A.rpc('billing_overview')).data
ok(sent.data === 1 && o.request.status === 'link_sent' && o.request.payment_link === 'https://pay.example/pme-mois', 'le lien enregistré est remis à la demande en attente')
ok((await P.rpc('admin_overview')).data.requests.some((r) => r.id === req.data && r.organization_name === 'Client A'), 'le propriétaire voit la demande')
ok((await B.rpc('submit_payment_reference', { p_request: req.data, p_ref: 'TX0001' })).error, 'B ne peut pas répondre à la demande de A')
ok(!(await A.rpc('submit_payment_reference', { p_request: req.data, p_ref: ` ${REF} ` })).error, 'A envoie sa référence')
ok((await A.rpc('admin_validate_payment', { p_request: req.data })).error?.code === '42501', 'A ne peut pas valider son propre paiement')
ok(!(await P.rpc('admin_reject_payment', { p_request: req.data, p_reason: 'Montant incomplet.' })).error, 'le propriétaire refuse')
o = (await A.rpc('billing_overview')).data
ok(o.request.status === 'link_sent' && /Montant incomplet/.test(o.request.rejection_reason), 'A voit le motif et peut recommencer')
await A.rpc('submit_payment_reference', { p_request: req.data, p_ref: REF })
const val = await P.rpc('admin_validate_payment', { p_request: req.data })
o = (await A.rpc('billing_overview')).data
const days = (new Date(o.current_period_end) - Date.now()) / 86400000
ok(!val.error && o.state === 'active' && o.plan_id === 'pme' && !o.request && days > 27 && days < 32, `abonnement actif pour un mois (${Math.round(days)} j)`)
ok((await A.from('payments').select('*')).data.length === 1, 'le paiement est enregistré')
ok((await P.rpc('admin_validate_payment', { p_request: req.data })).error, 'un paiement ne se valide pas deux fois')

// Une demande faite après l'enregistrement du lien le reçoit tout de suite.
const reqB = await B.rpc('request_subscription', { p_plan: 'pme', p_interval: 'month', p_name: 'Kossi', p_phone: '+22890123456' })
ok((await B.rpc('billing_overview')).data.request.status === 'link_sent', 'lien remis immédiatement à la demande suivante')
ok((await B.rpc('submit_payment_reference', { p_request: reqB.data, p_ref: REF })).error, 'une référence déjà validée est refusée')
ok(!(await B.rpc('cancel_payment_request', { p_request: reqB.data })).error && !(await B.rpc('billing_overview')).data.request, 'B annule sa demande')

// Renouvellement anticipé : la période s'ajoute.
const renew = await A.rpc('request_subscription', { p_plan: 'pme', p_interval: 'month', p_name: 'Awa', p_phone: '+237612345678' })
await P.rpc('admin_validate_payment', { p_request: renew.data })
o = (await A.rpc('billing_overview')).data
ok((new Date(o.current_period_end) - Date.now()) / 86400000 > 57, 'un renouvellement anticipé prolonge la période')

// --- Limites
const order = (await A.from('purchase_orders').select('id, items:purchase_order_items(id)').limit(1)).data[0]
const newShipment = (c, org, ref) => c.from('shipments').insert({ organization_id: org, purchase_order_id: order.id, reference: ref })
ok(!(await newShipment(A, orgA, 'LIM-1')).error, 'offre PME : expéditions illimitées')
for (const m of ['m1', 'm2']) await A.rpc('invite_member', { p_email: `${m}${t}@numera.test` })
ok((await A.rpc('invite_member', { p_email: `m3${t}@numera.test` })).error?.code === 'NUM01', 'offre PME : 3 utilisateurs, invitations comprises')

sql(`update public.subscriptions set current_period_end = now() - interval '10 days' where organization_id = '${orgA}'`)
o = (await A.rpc('billing_overview')).data
ok(o.state === 'free' && o.plan_id === 'decouverte' && o.had_paid_plan, 'abonnement échu : retour à l’offre Découverte')
const blocked = await newShipment(A, orgA, 'LIM-2')
ok(blocked.error?.code === 'NUM01', 'Découverte : nouvelle expédition bloquée : ' + blocked.error?.message)
ok((await A.from('shipments').select('id')).data.length === 9, 'les expéditions existantes restent accessibles')
const delivered = (await A.from('shipments').select('id').eq('status', 'delivered').limit(1)).data[0]
ok((await A.from('shipments').update({ status: 'cleared' }).eq('id', delivered.id).select()).error?.code === 'NUM01', 'rouvrir une expédition livrée est bloqué aussi')
const active = (await A.from('shipments').select('id').eq('status', 'at_sea').limit(1)).data[0]
ok(!(await A.from('shipments').update({ status: 'at_port' }).eq('id', active.id)).error, 'faire avancer une expédition en cours reste possible')
ok((await A.rpc('invite_member', { p_email: `m9${t}@numera.test` })).error?.code === 'NUM01', 'Découverte : pas d’invitation au-delà de 1 utilisateur')

sql(`update public.subscriptions set status = 'trialing', trial_ends_at = now() - interval '1 day', current_period_end = null where organization_id = '${orgB}'`)
o = (await B.rpc('billing_overview')).data
ok(o.state === 'free' && !o.had_paid_plan, 'essai terminé : offre Découverte')
const supB = (await B.from('suppliers').insert({ organization_id: orgB, name: 'F' }).select('id').single()).data
const poB = (await B.from('purchase_orders').insert({ organization_id: orgB, supplier_id: supB.id, reference: 'B-1', currency: 'USD', exchange_rate: 600 }).select('id').single()).data
const shipB = (ref) => B.from('shipments').insert({ organization_id: orgB, purchase_order_id: poB.id, reference: ref })
ok(!(await shipB('B-1')).error && !(await shipB('B-2')).error && (await shipB('B-3')).error?.code === 'NUM01', 'Découverte : 2 expéditions en cours, la 3e est refusée')

import { createClient } from '@supabase/supabase-js'
// Vérifie l'isolation entre entreprises sur une pile Supabase locale (npx supabase start).
const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const key = process.env.SUPABASE_ANON_KEY
if (!key) throw new Error('SUPABASE_ANON_KEY manquant (clé publishable affichée par « supabase status »).')
const mk = () => createClient(url, key, { auth: { persistSession: false } })
const A = mk(), B = mk(), anon = mk()
const ok = (c, m) => {
  console.log(c ? 'PASS' : 'FAIL', m)
  if (!c) process.exitCode = 1
}
const t = Date.now()
await A.auth.signUp({ email: `a${t}@numera.test`, password: 'motdepasse1' })
await B.auth.signUp({ email: `b${t}@numera.test`, password: 'motdepasse1' })
const { data: orgA } = await A.rpc('create_organization', { p_name: 'Entreprise A', p_country: 'Cameroun', p_currency: 'XAF', p_with_demo: true })
const { data: orgB } = await B.rpc('create_organization', { p_name: 'Entreprise B', p_country: 'Togo', p_currency: 'XOF', p_with_demo: false })
ok(orgA && orgB, 'deux entreprises créées')
const again = await A.rpc('create_organization', { p_name: 'X2', p_country: 'Togo', p_currency: 'XOF' })
ok(again.error, 'une seule entreprise par compte : ' + again.error?.message)
const sa = await A.from('shipments').select('id, destination_port, purchase_order_id')
ok(sa.data.length === 8, `A voit ses 8 expéditions (${sa.data.length}), port ${sa.data[0].destination_port}`)
for (const tb of ['organizations','organization_members','suppliers','purchase_orders','purchase_order_items','shipments','shipment_items','shipment_events','documents','shipment_costs','exchange_rates']) {
  const b = await B.from(tb).select('*')
  const expected = tb === 'organizations' || tb === 'organization_members' ? 1 : tb === 'exchange_rates' ? 3 : 0
  ok(b.data?.length === expected, `B ne voit que ses lignes dans ${tb} (${b.data?.length})`)
  const an = await anon.from(tb).select('*')
  ok(an.error || an.data.length === 0, `anonyme bloqué sur ${tb}`)
}
const ins = await B.from('suppliers').insert({ organization_id: orgA, name: 'intrus' })
ok(ins.error, 'B ne peut pas écrire chez A : ' + ins.error?.code)
const supB = await B.from('suppliers').insert({ organization_id: orgB, name: 'Fournisseur B' }).select('id').single()
const poB = await B.from('purchase_orders').insert({ organization_id: orgB, supplier_id: supB.data.id, reference: 'B-1', currency: 'USD', exchange_rate: 600 }).select('id').single()
ok(poB.data, 'B crée sa commande')
const cross = await B.from('shipments').insert({ organization_id: orgB, purchase_order_id: sa.data[0].purchase_order_id, reference: 'B-X' })
ok(cross.error, 'B ne peut pas rattacher une expédition à une commande de A : ' + cross.error?.code)
const upd = await B.from('shipments').update({ notes: 'hack' }).eq('id', sa.data[0].id).select()
ok(upd.data?.length === 0, 'B ne peut pas modifier une expédition de A')
const del = await B.from('organizations').delete().eq('id', orgA).select()
ok(!del.data?.length, 'B ne peut pas supprimer A')
const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
const upA = await A.storage.from('documents').upload(`${orgA}/x/invoice-1.pdf`, file)
ok(!upA.error, 'A dépose un fichier dans son dossier')
const upB = await B.storage.from('documents').upload(`${orgA}/x/invoice-2.pdf`, file)
ok(upB.error, 'B ne peut pas déposer chez A : ' + upB.error?.message)
const dlB = await B.storage.from('documents').download(`${orgA}/x/invoice-1.pdf`)
ok(dlB.error, 'B ne peut pas lire le fichier de A')
const sgB = await B.storage.from('documents').createSignedUrl(`${orgA}/x/invoice-1.pdf`, 60)
ok(sgB.error, 'B ne peut pas signer une URL chez A')
const big = await A.storage.from('documents').upload(`${orgA}/x/a.exe`, new Blob(['MZ'], { type: 'application/x-msdownload' }))
ok(big.error, 'type de fichier refusé : ' + big.error?.message)
const ev = await A.from('shipment_events').select('id')
ok(ev.data.length === 8, `historique des statuts tenu (${ev.data.length})`)
const seed = await B.rpc('seed_demo', { org: orgB })
ok(seed.error, 'seed_demo non exposé : ' + seed.error?.code)

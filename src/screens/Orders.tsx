import { useState } from 'react'
import type { FormEvent } from 'react'
import { Empty, Field, Icon, Notice, PageHeader, StatusBadge } from '../components/ui.tsx'
import { CURRENCY_LABEL, FOREIGN_CURRENCIES, INCOTERMS, UNITS } from '../lib/constants.ts'
import { orderTotal, orderTotalFcfa, rateFor } from '../lib/costs.ts'
import { fcfa, fullDate, isLocal, money, parseNumber, todayISO } from '../lib/format.ts'
import { navigate } from '../lib/router.ts'
import { useStore } from '../lib/store.tsx'
import { explain, supabase } from '../lib/supabase.ts'
import type { Currency, Order } from '../lib/types.ts'

export default function Orders({ rest }: { rest: string[] }) {
  const { orders } = useStore()
  if (rest[0] === 'nouvelle') return <OrderForm key="new" />
  if (rest[0]) {
    const order = orders.find((o) => o.id === rest[0])
    return order ? <OrderForm key={order.id} order={order} /> : <NotFound />
  }
  return <OrderList />
}

const NotFound = () => (
  <>
    <PageHeader title="Commande introuvable" back="/commandes" />
    <Empty title="Cette commande n’existe pas ou a été supprimée." />
  </>
)

function OrderList() {
  const { orders, shipments, supplierOf } = useStore()
  return (
    <>
      <PageHeader
        title="Commandes fournisseurs"
        action={
          <a className="btn btn-primary" href="#/commandes/nouvelle">
            <Icon name="plus" />
            Nouvelle
          </a>
        }
      />
      {orders.length === 0 ? (
        <Empty title="Aucune commande enregistrée">
          <p>Saisissez votre première commande : fournisseur, produits, prix d’achat et incoterm.</p>
        </Empty>
      ) : (
        <div className="list">
          {orders.map((o) => {
            const count = shipments.filter((s) => s.purchase_order_id === o.id).length
            return (
              <a key={o.id} className="row" href={`#/commandes/${o.id}`}>
                <div className="row-main">
                  <div className="row-title">
                    <strong>{o.reference}</strong>
                    <span className="chip">{o.incoterm}</span>
                  </div>
                  <p className="row-sub">
                    {supplierOf(o)?.name ?? 'Fournisseur inconnu'} · {fullDate(o.order_date)}
                  </p>
                  <p className="row-meta">
                    {o.items.length} produit{o.items.length > 1 ? 's' : ''} ·{' '}
                    {count ? `${count} expédition${count > 1 ? 's' : ''}` : 'pas encore expédiée'}
                  </p>
                </div>
                <div className="row-amount">
                  <strong>{fcfa(orderTotalFcfa(o))}</strong>
                  {!isLocal(o.currency) && <span>{money(orderTotal(o), o.currency)}</span>}
                </div>
                <Icon name="chevron" size={18} />
              </a>
            )
          })}
        </div>
      )}
    </>
  )
}

interface ItemDraft {
  id: string
  product_name: string
  quantity: string
  unit: string
  unit_price: string
  sale: string
}

const blankItem = (): ItemDraft => ({
  id: crypto.randomUUID(),
  product_name: '',
  quantity: '',
  unit: 'pièce',
  unit_price: '',
  sale: '',
})

const str = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

function nextReference(orders: Order[]) {
  const year = new Date().getFullYear()
  const max = orders.reduce((m, o) => {
    const match = o.reference.match(/^CMD-(\d{4})-(\d+)$/)
    return match && Number(match[1]) === year ? Math.max(m, Number(match[2])) : m
  }, 0)
  return `CMD-${year}-${String(max + 1).padStart(3, '0')}`
}

function OrderForm({ order }: { order?: Order }) {
  const { org, orders, suppliers, shipments, rates, reload } = useStore()
  const linked = order ? shipments.filter((s) => s.purchase_order_id === order.id) : []

  const [reference, setReference] = useState(order?.reference ?? nextReference(orders))
  const [supplierId, setSupplierId] = useState(order?.supplier_id ?? suppliers[0]?.id ?? 'new')
  const [newSupplier, setNewSupplier] = useState({ name: '', country: '' })
  const [date, setDate] = useState(order?.order_date ?? todayISO())
  const [currency, setCurrency] = useState<Currency>(
    order?.currency ?? suppliers[0]?.default_currency ?? 'USD',
  )
  const [rate, setRate] = useState(str(order?.exchange_rate ?? rateFor(currency, rates)))
  const [incoterm, setIncoterm] = useState(order?.incoterm ?? 'FOB')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [items, setItems] = useState<ItemDraft[]>(
    order?.items.map((it) => ({
      id: it.id,
      product_name: it.product_name,
      quantity: str(it.quantity),
      unit: it.unit,
      unit_price: str(it.unit_price),
      sale: str(it.sale_unit_price_fcfa),
    })) ?? [blankItem()],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const local = isLocal(currency)
  const rateValue = local ? 1 : (parseNumber(rate) ?? 0)
  const total = items.reduce(
    (s, it) => s + (parseNumber(it.quantity) ?? 0) * (parseNumber(it.unit_price) ?? 0),
    0,
  )

  function pickCurrency(c: Currency) {
    setCurrency(c)
    setRate(str(rateFor(c, rates)))
  }

  function pickSupplier(id: string) {
    setSupplierId(id)
    const s = suppliers.find((x) => x.id === id)
    if (s && !order) pickCurrency(isLocal(s.default_currency) ? org.currency : s.default_currency)
  }

  const setItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    const rows = items.map((it, position) => ({
      id: it.id,
      position,
      product_name: it.product_name.trim(),
      quantity: parseNumber(it.quantity),
      unit: it.unit,
      unit_price: parseNumber(it.unit_price),
      sale_unit_price_fcfa: parseNumber(it.sale),
    }))
    if (rows.some((r) => !r.product_name || !r.quantity || r.quantity <= 0 || r.unit_price == null || r.unit_price < 0))
      return setError('Chaque produit doit avoir un nom, une quantité et un prix d’achat.')
    if (!local && rateValue <= 0) return setError('Indiquez le taux de change vers le FCFA.')
    if (supplierId === 'new' && !newSupplier.name.trim()) return setError('Indiquez le nom du fournisseur.')

    setBusy(true)
    try {
      let supplier = supplierId
      if (supplierId === 'new') {
        const { data, error: err } = await supabase
          .from('suppliers')
          .insert({
            organization_id: org.id,
            name: newSupplier.name.trim(),
            country: newSupplier.country.trim() || null,
            default_currency: currency,
          })
          .select('id')
          .single()
        if (err) throw err
        supplier = data.id
      }
      const payload = {
        organization_id: org.id,
        supplier_id: supplier,
        reference: reference.trim(),
        order_date: date,
        currency,
        exchange_rate: rateValue,
        incoterm,
        notes: notes.trim() || null,
      }
      let orderId = order?.id
      if (order) {
        const { error: err } = await supabase.from('purchase_orders').update(payload).eq('id', order.id)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.from('purchase_orders').insert(payload).select('id').single()
        if (err) throw err
        orderId = data.id
      }
      const removed = order?.items.filter((it) => !rows.some((r) => r.id === it.id)).map((it) => it.id) ?? []
      if (removed.length) {
        const { error: err } = await supabase.from('purchase_order_items').delete().in('id', removed)
        if (err) throw err
      }
      const { error: err } = await supabase
        .from('purchase_order_items')
        .upsert(rows.map((r) => ({ ...r, organization_id: org.id, purchase_order_id: orderId })))
      if (err) throw err
      await reload(['suppliers', 'orders'])
      navigate('/commandes')
    } catch (err) {
      setError(explain(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!order || !window.confirm(`Supprimer la commande ${order.reference} ?`)) return
    setBusy(true)
    const { error: err } = await supabase.from('purchase_orders').delete().eq('id', order.id)
    if (err) {
      setError(explain(err))
      setBusy(false)
      return
    }
    await reload(['orders'])
    navigate('/commandes')
  }

  return (
    <form onSubmit={save} className="form">
      <PageHeader title={order ? order.reference : 'Nouvelle commande'} back="/commandes" />

      <fieldset className="panel">
        <legend>Commande</legend>
        <div className="grid-2">
          <Field label="Référence">
            <input value={reference} onChange={(e) => setReference(e.target.value)} required />
          </Field>
          <Field label="Date de commande">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="Fournisseur">
          <select value={supplierId} onChange={(e) => pickSupplier(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.country ? ` (${s.country})` : ''}
              </option>
            ))}
            <option value="new">+ Nouveau fournisseur…</option>
          </select>
        </Field>
        {supplierId === 'new' && (
          <div className="grid-2">
            <Field label="Nom du fournisseur">
              <input
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
              />
            </Field>
            <Field label="Pays">
              <input
                value={newSupplier.country}
                onChange={(e) => setNewSupplier({ ...newSupplier, country: e.target.value })}
              />
            </Field>
          </div>
        )}
        <div className="grid-3">
          <Field label="Devise d’achat">
            <select value={currency} onChange={(e) => pickCurrency(e.target.value as Currency)}>
              {FOREIGN_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
              <option value={org.currency}>FCFA</option>
            </select>
          </Field>
          {!local && (
            <Field label={`Taux : 1 ${currency} en FCFA`} hint="Figé sur cette commande.">
              <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          )}
          <Field label="Incoterm">
            <select value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
              {INCOTERMS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="panel">
        <legend>Produits</legend>
        {items.map((it, i) => (
          <div className="item" key={it.id}>
            <div className="item-head">
              <span>Produit {i + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Retirer le produit ${i + 1}`}
                  onClick={() => setItems((list) => list.filter((x) => x.id !== it.id))}
                >
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
            <Field label="Désignation">
              <input value={it.product_name} onChange={(e) => setItem(it.id, { product_name: e.target.value })} />
            </Field>
            <div className="grid-4">
              <Field label="Quantité">
                <input
                  inputMode="decimal"
                  value={it.quantity}
                  onChange={(e) => setItem(it.id, { quantity: e.target.value })}
                />
              </Field>
              <Field label="Unité">
                <select value={it.unit} onChange={(e) => setItem(it.id, { unit: e.target.value })}>
                  {(UNITS.includes(it.unit) ? UNITS : [it.unit, ...UNITS]).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label={`Prix d’achat (${CURRENCY_LABEL[currency]})`}>
                <input
                  inputMode="decimal"
                  value={it.unit_price}
                  onChange={(e) => setItem(it.id, { unit_price: e.target.value })}
                />
              </Field>
              <Field label="Prix de vente (FCFA)" hint="Prévu, pour la marge.">
                <input inputMode="decimal" value={it.sale} onChange={(e) => setItem(it.id, { sale: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setItems((list) => [...list, blankItem()])}>
          <Icon name="plus" />
          Ajouter un produit
        </button>
        <dl className="totals">
          {!local && (
            <div>
              <dt>Total en {currency}</dt>
              <dd>{money(total, currency)}</dd>
            </div>
          )}
          <div className="totals-main">
            <dt>Total en FCFA</dt>
            <dd>{fcfa(total * rateValue)}</dd>
          </div>
        </dl>
      </fieldset>

      <fieldset className="panel">
        <legend>Notes</legend>
        <Field label="Remarques (facultatif)">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </fieldset>

      {order && (
        <section className="panel">
          <h2>Expéditions de cette commande</h2>
          {linked.length === 0 ? (
            <p className="muted">Aucune expédition pour l’instant.</p>
          ) : (
            <ul className="plain">
              {linked.map((s) => (
                <li key={s.id}>
                  <a href={`#/expeditions/${s.id}`}>{s.reference}</a> <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
          <a className="btn" href={`#/expeditions/nouvelle?commande=${order.id}`}>
            <Icon name="ship" />
            Créer une expédition
          </a>
        </section>
      )}

      {error && <Notice>{error}</Notice>}
      <div className="actions">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer la commande'}
        </button>
        {order && (
          <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  )
}

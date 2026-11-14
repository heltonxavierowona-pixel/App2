import { useState } from 'react'
import type { FormEvent } from 'react'
import { ShipmentRow } from '../components/ShipmentRow.tsx'
import { Empty, Field, Icon, LateBadge, Notice, PageHeader, RouteDetail, StatusBadge } from '../components/ui.tsx'
import { DOC_TYPES, STATUSES, STATUS_LABEL } from '../lib/constants.ts'
import { lateDays, missingDocs } from '../lib/costs.ts'
import { fullDate, parseNumber, quantity, shortDate, todayISO } from '../lib/format.ts'
import { navigate } from '../lib/router.ts'
import { useStore } from '../lib/store.tsx'
import { explain, supabase } from '../lib/supabase.ts'
import type { Order, Shipment, Status } from '../lib/types.ts'

export default function Shipments({ rest, query }: { rest: string[]; query: URLSearchParams }) {
  const { shipments } = useStore()
  if (rest[0] === 'nouvelle') return <ShipmentForm key="new" orderId={query.get('commande') ?? undefined} />
  if (rest[0]) {
    const shipment = shipments.find((s) => s.id === rest[0])
    if (!shipment)
      return (
        <>
          <PageHeader title="Expédition introuvable" back="/expeditions" />
          <Empty title="Cette expédition n’existe pas ou a été supprimée." />
        </>
      )
    return rest[1] === 'modifier' ? (
      <ShipmentForm key={shipment.id} shipment={shipment} />
    ) : (
      <ShipmentDetail key={shipment.id} shipment={shipment} />
    )
  }
  return <ShipmentList filter={query.get('filtre') ?? 'toutes'} />
}

function ShipmentList({ filter }: { filter: string }) {
  const { shipments, orders } = useStore()
  const today = todayISO()
  const filters: { key: string; label: string; test: (s: Shipment) => boolean }[] = [
    { key: 'toutes', label: 'Toutes', test: () => true },
    { key: 'en-cours', label: 'En cours', test: (s) => s.status !== 'delivered' },
    { key: 'retard', label: 'En retard', test: (s) => lateDays(s, today) > 0 },
    { key: 'arrivees', label: 'Arrivées', test: (s) => s.status === 'at_port' || s.status === 'cleared' },
    ...STATUSES.map((st) => ({ key: st, label: STATUS_LABEL[st], test: (s: Shipment) => s.status === st })),
  ]
  const active = filters.find((f) => f.key === filter) ?? filters[0]
  const shown = shipments
    .filter(active.test)
    .sort(
      (a, b) =>
        lateDays(b, today) - lateDays(a, today) ||
        (a.planned_arrival ?? '9999').localeCompare(b.planned_arrival ?? '9999'),
    )

  return (
    <>
      <PageHeader
        title="Expéditions"
        action={
          orders.length > 0 && (
            <a className="btn btn-primary" href="#/expeditions/nouvelle">
              <Icon name="plus" />
              Nouvelle
            </a>
          )
        }
      />
      {shipments.length === 0 ? (
        <Empty title="Aucune expédition">
          <p>
            {orders.length
              ? 'Créez une expédition à partir d’une commande pour suivre son conteneur.'
              : 'Enregistrez d’abord une commande fournisseur.'}
          </p>
        </Empty>
      ) : (
        <>
          <nav className="filters" aria-label="Filtrer les expéditions">
            {filters.map((f) => (
              <a
                key={f.key}
                href={`#/expeditions?filtre=${f.key}`}
                className="filter"
                aria-current={f.key === active.key ? 'true' : undefined}
              >
                {f.label}
                <span className="filter-count">{shipments.filter(f.test).length}</span>
              </a>
            ))}
          </nav>
          {shown.length === 0 ? (
            <Empty title={`Aucune expédition « ${active.label.toLowerCase()} »`}>
              <a className="btn" href="#/expeditions">
                Voir toutes les expéditions
              </a>
            </Empty>
          ) : (
            <div className="list">
              {shown.map((s) => (
                <ShipmentRow key={s.id} shipment={s} href={`/expeditions/${s.id}`} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

/** Date réelle renseignée lorsqu'une expédition atteint une étape. */
const ACTUAL_FIELD: Partial<Record<Status, keyof Shipment>> = {
  shipped: 'actual_departure',
  at_port: 'actual_arrival',
  cleared: 'actual_clearance',
  delivered: 'actual_delivery',
}

function ShipmentDetail({ shipment: s }: { shipment: Shipment }) {
  const { orderOf, supplierOf, reload } = useStore()
  const order = orderOf(s)
  const today = todayISO()
  const late = lateDays(s, today)
  const next = STATUSES[STATUSES.indexOf(s.status) + 1] as Status | undefined
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const missing = missingDocs(s).length

  async function advance() {
    if (!next) return
    setBusy(true)
    setError('')
    const field = ACTUAL_FIELD[next]
    const { error: err } = await supabase
      .from('shipments')
      .update({ status: next, ...(field ? { [field]: date } : {}) })
      .eq('id', s.id)
    if (err) setError(explain(err))
    else await reload(['shipments', 'billing'])
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title={s.reference}
        back="/expeditions"
        action={
          <a className="btn" href={`#/expeditions/${s.id}/modifier`}>
            <Icon name="edit" />
            Modifier
          </a>
        }
      >
        <p className="page-sub">
          <StatusBadge status={s.status} /> <LateBadge days={late} />
          <span>{supplierOf(order)?.name}</span>
        </p>
      </PageHeader>

      <section className="panel">
        <h2>Parcours</h2>
        <RouteDetail
          status={s.status}
          late={late > 0}
          format={shortDate}
          stops={[
            { status: 'ordered', actual: order?.order_date },
            { status: 'shipped', planned: s.planned_departure, actual: s.actual_departure },
            { status: 'at_sea' },
            { status: 'at_port', planned: s.planned_arrival, actual: s.actual_arrival },
            { status: 'cleared', planned: s.planned_clearance, actual: s.actual_clearance },
            { status: 'delivered', planned: s.planned_delivery, actual: s.actual_delivery },
          ]}
        />
        {next && (
          <div className="advance">
            {ACTUAL_FIELD[next] && (
              <Field label={`Date : ${STATUS_LABEL[next].toLowerCase()}`}>
                <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
              </Field>
            )}
            <button className="btn btn-primary" onClick={advance} disabled={busy}>
              <Icon name="check" />
              {busy ? 'Mise à jour…' : `Passer à « ${STATUS_LABEL[next]} »`}
            </button>
          </div>
        )}
        {error && <Notice>{error}</Notice>}
      </section>

      <section className="panel">
        <h2>Transport</h2>
        <dl className="facts">
          <Fact label="Conteneur" value={s.container_number} />
          <Fact label="Connaissement" value={s.bl_number} />
          <Fact label="Armateur" value={s.carrier} />
          <Fact label="Port de départ" value={s.origin_port} />
          <Fact label="Port d’arrivée" value={s.destination_port} />
          <div>
            <dt>Commande</dt>
            <dd>
              {order ? (
                <a href={`#/commandes/${order.id}`}>
                  {order.reference} · {order.incoterm}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
        {s.notes && <p className="note">{s.notes}</p>}
      </section>

      <section className="panel">
        <h2>Marchandises</h2>
        <ul className="plain goods">
          {s.items.map((si) => {
            const item = order?.items.find((it) => it.id === si.purchase_order_item_id)
            return (
              <li key={si.id}>
                <span>{item?.product_name ?? 'Produit supprimé'}</span>
                <strong>
                  {quantity(si.quantity)} {item?.unit}
                </strong>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="link-cards">
        <a className="row" href={`#/documents/${s.id}`}>
          <div className="row-main">
            <strong>Documents</strong>
            <p className="row-sub">
              {missing
                ? `${missing} pièce${missing > 1 ? 's' : ''} manquante${missing > 1 ? 's' : ''} sur ${DOC_TYPES.length}`
                : 'Dossier complet'}
            </p>
          </div>
          <Icon name="chevron" size={18} />
        </a>
        <a className="row" href={`#/couts/${s.id}`}>
          <div className="row-main">
            <strong>Coût de revient</strong>
            <p className="row-sub">
              {s.costs.length ? `${s.costs.length} poste${s.costs.length > 1 ? 's' : ''} de frais saisi${s.costs.length > 1 ? 's' : ''}` : 'Frais à saisir'}
            </p>
          </div>
          <Icon name="chevron" size={18} />
        </a>
      </div>
    </>
  )
}

const Fact = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value || '—'}</dd>
  </div>
)

function nextReference(shipments: Shipment[]) {
  const year = new Date().getFullYear()
  const max = shipments.reduce((m, s) => {
    const match = s.reference.match(/^EXP-(\d{4})-(\d+)$/)
    return match && Number(match[1]) === year ? Math.max(m, Number(match[2])) : m
  }, 0)
  return `EXP-${year}-${String(max + 1).padStart(3, '0')}`
}

const DATE_FIELDS = [
  ['departure', 'Départ'],
  ['arrival', 'Arrivée au port'],
  ['clearance', 'Dédouanement'],
  ['delivery', 'Livraison'],
] as const

type DateKey = `${'planned' | 'actual'}_${(typeof DATE_FIELDS)[number][0]}`

function ShipmentForm({ shipment, orderId }: { shipment?: Shipment; orderId?: string }) {
  const { org, orders, shipments, supplierOf, reload } = useStore()
  const [order, setOrder] = useState<Order | undefined>(
    orders.find((o) => o.id === (shipment?.purchase_order_id ?? orderId)) ?? orders[0],
  )

  /** Quantité d'une ligne de commande pas encore affectée à une autre expédition. */
  const remaining = (itemId: string, ordered: number) =>
    ordered -
    shipments
      .filter((s) => s.id !== shipment?.id)
      .flatMap((s) => s.items)
      .filter((si) => si.purchase_order_item_id === itemId)
      .reduce((sum, si) => sum + si.quantity, 0)

  const initialQty = (o: Order | undefined) =>
    Object.fromEntries(
      (o?.items ?? []).map((it) => {
        const existing = shipment?.items.find((si) => si.purchase_order_item_id === it.id)
        const value = shipment ? (existing?.quantity ?? 0) : Math.max(0, remaining(it.id, it.quantity))
        return [it.id, value ? String(value).replace('.', ',') : '']
      }),
    )

  const [qty, setQty] = useState<Record<string, string>>(() => initialQty(order))
  const [f, setF] = useState({
    reference: shipment?.reference ?? nextReference(shipments),
    status: shipment?.status ?? ('ordered' as Status),
    container_number: shipment?.container_number ?? '',
    bl_number: shipment?.bl_number ?? '',
    carrier: shipment?.carrier ?? '',
    origin_port: shipment?.origin_port ?? '',
    destination_port: shipment?.destination_port ?? '',
    notes: shipment?.notes ?? '',
  })
  const [dates, setDates] = useState<Record<DateKey, string>>(
    () =>
      Object.fromEntries(
        DATE_FIELDS.flatMap(([k]) =>
          (['planned', 'actual'] as const).map((p) => [`${p}_${k}`, shipment?.[`${p}_${k}`] ?? '']),
        ),
      ) as Record<DateKey, string>,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!order) return setError('Choisissez une commande.')
    const lines = order.items
      .map((it) => ({ purchase_order_item_id: it.id, quantity: parseNumber(qty[it.id] ?? '') ?? 0 }))
      .filter((l) => l.quantity > 0)
    if (lines.length === 0) return setError('Indiquez la quantité expédiée pour au moins un produit.')

    setBusy(true)
    try {
      const payload = {
        organization_id: org.id,
        purchase_order_id: order.id,
        reference: f.reference.trim(),
        status: f.status,
        container_number: f.container_number.trim() || null,
        bl_number: f.bl_number.trim() || null,
        carrier: f.carrier.trim() || null,
        origin_port: f.origin_port.trim() || null,
        destination_port: f.destination_port.trim() || null,
        notes: f.notes.trim() || null,
        ...Object.fromEntries(Object.entries(dates).map(([k, v]) => [k, v || null])),
      }
      let id = shipment?.id
      if (shipment) {
        const { error: err } = await supabase.from('shipments').update(payload).eq('id', shipment.id)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.from('shipments').insert(payload).select('id').single()
        if (err) throw err
        id = data.id
      }
      // On écrit d'abord les lignes conservées, puis on retire les autres :
      // un échec en cours de route ne vide jamais l'expédition.
      const { error: err } = await supabase
        .from('shipment_items')
        .upsert(
          lines.map((l) => ({ ...l, organization_id: org.id, shipment_id: id })),
          { onConflict: 'shipment_id,purchase_order_item_id' },
        )
      if (err) throw err
      const dropped = shipment?.items.filter((si) => !lines.some((l) => l.purchase_order_item_id === si.purchase_order_item_id))
      if (dropped?.length) {
        const { error: delErr } = await supabase
          .from('shipment_items')
          .delete()
          .in('id', dropped.map((si) => si.id))
        if (delErr) throw delErr
      }
      await reload(['shipments', 'billing'])
      navigate(`/expeditions/${id}`)
    } catch (err) {
      setError(explain(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!shipment || !window.confirm(`Supprimer l’expédition ${shipment.reference}, ses documents et ses frais ?`))
      return
    setBusy(true)
    const paths = shipment.documents.flatMap((d) => (d.file_path ? [d.file_path] : []))
    if (paths.length) await supabase.storage.from('documents').remove(paths)
    const { error: err } = await supabase.from('shipments').delete().eq('id', shipment.id)
    if (err) {
      setError(explain(err))
      setBusy(false)
      return
    }
    await reload(['shipments', 'billing'])
    navigate('/expeditions')
  }

  if (orders.length === 0)
    return (
      <>
        <PageHeader title="Nouvelle expédition" back="/expeditions" />
        <Empty title="Enregistrez d’abord une commande">
          <a className="btn btn-primary" href="#/commandes/nouvelle">
            Nouvelle commande
          </a>
        </Empty>
      </>
    )

  return (
    <form onSubmit={save} className="form">
      <PageHeader
        title={shipment ? `Modifier ${shipment.reference}` : 'Nouvelle expédition'}
        back={shipment ? `/expeditions/${shipment.id}` : '/expeditions'}
      />

      <fieldset className="panel">
        <legend>Expédition</legend>
        <Field label="Commande fournisseur">
          <select
            value={order?.id}
            disabled={Boolean(shipment)}
            onChange={(e) => {
              const o = orders.find((x) => x.id === e.target.value)
              setOrder(o)
              setQty(initialQty(o))
            }}
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} · {supplierOf(o)?.name} · {fullDate(o.order_date)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Référence">
            <input value={f.reference} onChange={(e) => set({ reference: e.target.value })} required />
          </Field>
          <Field label="Statut">
            <select value={f.status} onChange={(e) => set({ status: e.target.value as Status })}>
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABEL[st]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="panel">
        <legend>Quantités expédiées</legend>
        {order?.items.map((it) => (
          <Field
            key={it.id}
            label={it.product_name}
            hint={`Commandé : ${quantity(it.quantity)} ${it.unit} · reste à expédier : ${quantity(Math.max(0, remaining(it.id, it.quantity)))}`}
          >
            <input
              inputMode="decimal"
              value={qty[it.id] ?? ''}
              onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })}
            />
          </Field>
        ))}
      </fieldset>

      <fieldset className="panel">
        <legend>Transport</legend>
        <div className="grid-2">
          <Field label="N° de conteneur">
            <input
              value={f.container_number}
              onChange={(e) => set({ container_number: e.target.value })}
              autoCapitalize="characters"
            />
          </Field>
          <Field label="N° de connaissement (BL)">
            <input value={f.bl_number} onChange={(e) => set({ bl_number: e.target.value })} autoCapitalize="characters" />
          </Field>
          <Field label="Port de départ">
            <input value={f.origin_port} onChange={(e) => set({ origin_port: e.target.value })} />
          </Field>
          <Field label="Port d’arrivée">
            <input value={f.destination_port} onChange={(e) => set({ destination_port: e.target.value })} />
          </Field>
          <Field label="Armateur">
            <input value={f.carrier} onChange={(e) => set({ carrier: e.target.value })} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="panel">
        <legend>Dates</legend>
        <div className="dates">
          <span />
          <span className="dates-head">Prévue</span>
          <span className="dates-head">Réelle</span>
          {DATE_FIELDS.map(([k, label]) => (
            <div className="dates-row" key={k}>
              <span className="dates-label">{label}</span>
              {(['planned', 'actual'] as const).map((p) => (
                <input
                  key={p}
                  type="date"
                  aria-label={`${label}, date ${p === 'planned' ? 'prévue' : 'réelle'}`}
                  value={dates[`${p}_${k}`]}
                  onChange={(e) => setDates({ ...dates, [`${p}_${k}`]: e.target.value })}
                />
              ))}
            </div>
          ))}
        </div>
        <Field label="Remarques (facultatif)">
          <textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </fieldset>

      {error && <Notice>{error}</Notice>}
      <div className="actions">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer l’expédition'}
        </button>
        {shipment && (
          <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useProductSummary } from '../components/ShipmentRow.tsx'
import { Empty, Field, Icon, Notice, PageHeader, StatusBadge } from '../components/ui.tsx'
import { COST_CATEGORIES, COST_LABEL, EUR_PEG, FOREIGN_CURRENCIES } from '../lib/constants.ts'
import { lotCosting, rateFor, savedFees } from '../lib/costs.ts'
import { fcfa, isLocal, money, parseNumber, percent, quantity } from '../lib/format.ts'
import { useStore } from '../lib/store.tsx'
import { explain, supabase } from '../lib/supabase.ts'
import type { CostCategory, Currency, Shipment } from '../lib/types.ts'

export default function Costs({ rest }: { rest: string[] }) {
  const { shipments } = useStore()
  if (rest[0] === 'taux') return <RatesForm />
  if (rest[0]) {
    const shipment = shipments.find((s) => s.id === rest[0])
    return shipment ? (
      <LotCost key={shipment.id} shipment={shipment} />
    ) : (
      <>
        <PageHeader title="Lot introuvable" back="/couts" />
        <Empty title="Cette expédition n’existe pas ou a été supprimée." />
      </>
    )
  }
  return <CostList />
}

const Margin = ({ value, rate }: { value: number; rate: number | null }) => (
  <span className={value < 0 ? 'neg' : 'pos'}>
    {fcfa(value)}
    {rate != null && <small> ({percent(rate)})</small>}
  </span>
)

function CostList() {
  const { shipments, orderOf, rates } = useStore()
  const summary = useProductSummary()
  return (
    <>
      <PageHeader title="Coût de revient">
        <p className="page-sub rates-line">
          <span>
            1 USD = {quantity(rates.USD)} · 1 CNY = {quantity(rates.CNY)} · 1 EUR = {quantity(rates.EUR)} FCFA
          </span>
          <a href="#/couts/taux">Modifier les taux</a>
        </p>
      </PageHeader>
      {shipments.length === 0 ? (
        <Empty title="Aucun lot">
          <p>Le coût de revient se calcule par expédition : achat, fret, assurance, douane, transit et transport local.</p>
        </Empty>
      ) : (
        <div className="list">
          {shipments.map((s) => {
            const order = orderOf(s)
            if (!order) return null
            const c = lotCosting(s, order, savedFees(s))
            return (
              <a key={s.id} className="row" href={`#/couts/${s.id}`}>
                <div className="row-main">
                  <div className="row-title">
                    <strong>{s.reference}</strong>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="row-sub">{summary(s)}</p>
                  <dl className="row-figures">
                    <div>
                      <dt>Coût de revient</dt>
                      <dd>{fcfa(c.total)}</dd>
                    </div>
                    <div>
                      <dt>{s.status === 'delivered' ? 'Marge' : 'Marge provisoire'}</dt>
                      <dd>
                        <Margin value={c.margin} rate={c.marginRate} />
                      </dd>
                    </div>
                  </dl>
                  <p className="row-meta">
                    {s.costs.length} poste{s.costs.length > 1 ? 's' : ''} de frais sur {COST_CATEGORIES.length}
                  </p>
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

interface FeeDraft {
  amount: string
  currency: Currency
}

function LotCost({ shipment: s }: { shipment: Shipment }) {
  const { org, orderOf, supplierOf, rates, reload } = useStore()
  const order = orderOf(s)
  const [fees, setFees] = useState<Record<CostCategory, FeeDraft>>(
    () =>
      Object.fromEntries(
        COST_CATEGORIES.map((cat) => {
          const saved = s.costs.find((c) => c.category === cat)
          return [
            cat,
            { amount: saved ? String(saved.amount).replace('.', ',') : '', currency: saved?.currency ?? org.currency },
          ]
        }),
      ) as Record<CostCategory, FeeDraft>,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  if (!order) return <Empty title="Commande introuvable pour ce lot." />

  /** Un poste déjà enregistré garde son taux figé tant que sa devise ne change pas. */
  const rateOf = (cat: CostCategory) => {
    const prev = s.costs.find((c) => c.category === cat)
    const cur = fees[cat].currency
    return prev && prev.currency === cur ? Number(prev.exchange_rate) : rateFor(cur, rates)
  }
  const feeFcfa = (cat: CostCategory) => Math.round((parseNumber(fees[cat].amount) ?? 0) * rateOf(cat))
  const c = lotCosting(s, order, Object.fromEntries(COST_CATEGORIES.map((cat) => [cat, feeFcfa(cat)])))

  const setFee = (cat: CostCategory, patch: Partial<FeeDraft>) => {
    setSaved(false)
    setFees((prev) => ({ ...prev, [cat]: { ...prev[cat], ...patch } }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const rows = COST_CATEGORIES.flatMap((cat) => {
        const amount = parseNumber(fees[cat].amount)
        return amount != null && amount >= 0
          ? [
              {
                organization_id: org.id,
                shipment_id: s.id,
                category: cat,
                amount,
                currency: fees[cat].currency,
                exchange_rate: rateOf(cat),
              },
            ]
          : []
      })
      if (rows.length) {
        const { error: err } = await supabase
          .from('shipment_costs')
          .upsert(rows, { onConflict: 'shipment_id,category' })
        if (err) throw err
      }
      const cleared = s.costs.filter((prev) => !rows.some((r) => r.category === prev.category)).map((x) => x.id)
      if (cleared.length) {
        const { error: err } = await supabase.from('shipment_costs').delete().in('id', cleared)
        if (err) throw err
      }
      await reload(['shipments'])
      setSaved(true)
    } catch (err) {
      setError(explain(err))
    }
    setBusy(false)
  }

  return (
    <form onSubmit={save} className="form">
      <PageHeader title={`Coût du lot ${s.reference}`} back="/couts">
        <p className="page-sub">
          <StatusBadge status={s.status} />
          <span>
            {supplierOf(order)?.name} · {order.reference} · {order.incoterm}
          </span>
        </p>
      </PageHeader>

      <fieldset className="panel">
        <legend>Frais d’approche</legend>
        <div className="fee fee-fixed">
          <span className="fee-label">Achat</span>
          <span className="fee-detail">
            {isLocal(order.currency)
              ? 'Commande en FCFA'
              : `${money(c.purchase / order.exchange_rate, order.currency)} × ${quantity(order.exchange_rate)}`}
          </span>
          <strong className="fee-fcfa">{fcfa(c.purchase)}</strong>
        </div>
        {COST_CATEGORIES.map((cat) => (
          <div className="fee" key={cat}>
            <label className="fee-label" htmlFor={`fee-${cat}`}>
              {COST_LABEL[cat]}
            </label>
            <div className="fee-inputs">
              <input
                id={`fee-${cat}`}
                inputMode="decimal"
                placeholder="0"
                value={fees[cat].amount}
                onChange={(e) => setFee(cat, { amount: e.target.value })}
              />
              <select
                aria-label={`Devise : ${COST_LABEL[cat]}`}
                value={fees[cat].currency}
                onChange={(e) => setFee(cat, { currency: e.target.value as Currency })}
              >
                <option value={org.currency}>FCFA</option>
                {FOREIGN_CURRENCIES.map((cur) => (
                  <option key={cur}>{cur}</option>
                ))}
              </select>
            </div>
            <span className="fee-fcfa">
              {isLocal(fees[cat].currency) ? '' : `× ${quantity(rateOf(cat))} = `}
              {fcfa(feeFcfa(cat))}
            </span>
          </div>
        ))}
        {error && <Notice>{error}</Notice>}
        {saved && <Notice kind="ok">Frais enregistrés.</Notice>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer les frais'}
        </button>
      </fieldset>

      <section className="panel">
        <h2>Résultat du lot</h2>
        <dl className="result">
          <div>
            <dt>Achat</dt>
            <dd>{fcfa(c.purchase)}</dd>
          </div>
          <div>
            <dt>Frais d’approche</dt>
            <dd>{fcfa(c.feesTotal)}</dd>
          </div>
          <div className="result-main">
            <dt>Coût de revient</dt>
            <dd>{fcfa(c.total)}</dd>
          </div>
          <div>
            <dt>Ventes prévues</dt>
            <dd>{c.revenue ? fcfa(c.revenue) : '—'}</dd>
          </div>
          <div className="result-main">
            <dt>{s.status === 'delivered' ? 'Marge' : 'Marge provisoire'}</dt>
            <dd>{c.revenue ? <Margin value={c.margin} rate={c.marginRate} /> : '—'}</dd>
          </div>
        </dl>
        {c.missingSalePrice && (
          <Notice kind="info">
            Un produit n’a pas de prix de vente prévu : la marge ne porte que sur les autres.{' '}
            <a href={`#/commandes/${order.id}`}>Compléter la commande</a>
          </Notice>
        )}
      </section>

      <section className="panel">
        <h2>Par produit</h2>
        <p className="muted small">Les frais sont répartis au prorata de la valeur d’achat.</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Produit</th>
                <th scope="col">Quantité</th>
                <th scope="col">Coût unitaire</th>
                <th scope="col">Prix de vente</th>
                <th scope="col">Marge</th>
              </tr>
            </thead>
            <tbody>
              {c.lines.map((l) => (
                <tr key={l.item.id}>
                  <th scope="row">{l.item.product_name}</th>
                  <td data-label="Quantité">
                    {quantity(l.quantity)} {l.item.unit}
                  </td>
                  <td data-label="Coût unitaire">{fcfa(l.unitCost)}</td>
                  <td data-label="Prix de vente">
                    {l.item.sale_unit_price_fcfa == null ? '—' : fcfa(l.item.sale_unit_price_fcfa)}
                  </td>
                  <td data-label="Marge">
                    {l.margin == null || l.revenue == null ? (
                      '—'
                    ) : (
                      <Margin value={l.margin} rate={l.revenue > 0 ? l.margin / l.revenue : null} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  )
}

function RatesForm() {
  const { org, rates, reload } = useStore()
  const [usd, setUsd] = useState(String(rates.USD).replace('.', ','))
  const [cny, setCny] = useState(String(rates.CNY).replace('.', ','))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const values = { USD: parseNumber(usd), CNY: parseNumber(cny) }
    if (!values.USD || !values.CNY || values.USD <= 0 || values.CNY <= 0)
      return setError('Indiquez un taux supérieur à zéro pour chaque devise.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('exchange_rates').upsert(
      (['USD', 'CNY'] as const).map((currency) => ({
        organization_id: org.id,
        currency,
        rate: values[currency],
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'organization_id,currency' },
    )
    if (err) setError(explain(err))
    else {
      await reload(['rates'])
      setSaved(true)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={save} className="form">
      <PageHeader title="Taux de change" back="/couts">
        <p className="page-sub">
          Ces taux servent aux nouvelles commandes et aux nouveaux frais. Les montants déjà enregistrés gardent
          leur taux.
        </p>
      </PageHeader>
      <fieldset className="panel">
        <legend>Valeur en FCFA</legend>
        <Field label="1 EUR" hint="Parité fixe avec le franc CFA.">
          <input value={String(EUR_PEG).replace('.', ',')} readOnly />
        </Field>
        <Field label="1 USD">
          <input
            inputMode="decimal"
            value={usd}
            onChange={(e) => {
              setUsd(e.target.value)
              setSaved(false)
            }}
          />
        </Field>
        <Field label="1 CNY">
          <input
            inputMode="decimal"
            value={cny}
            onChange={(e) => {
              setCny(e.target.value)
              setSaved(false)
            }}
          />
        </Field>
        {error && <Notice>{error}</Notice>}
        {saved && <Notice kind="ok">Taux enregistrés.</Notice>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer les taux'}
        </button>
      </fieldset>
    </form>
  )
}

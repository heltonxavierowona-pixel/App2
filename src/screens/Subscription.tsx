import { useState } from 'react'
import type { FormEvent } from 'react'
import { Field, Icon, Notice, PageHeader } from '../components/ui.tsx'
import { planOf, stateSentence } from '../lib/billing.ts'
import { fcfa } from '../lib/format.ts'
import { useStore } from '../lib/store.tsx'
import { explain, supabase } from '../lib/supabase.ts'
import type { BillingInterval, PaymentRequest, Plan } from '../lib/types.ts'

const INTERVAL_LABEL: Record<BillingInterval, string> = { month: 'par mois', year: 'par an' }

export default function Subscription() {
  const { billing, role, org, reload } = useStore()
  const isAdmin = role === 'admin'
  const current = planOf(billing)
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [choice, setChoice] = useState<Plan | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function request(e: FormEvent) {
    e.preventDefault()
    if (!choice) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('request_subscription', {
      p_plan: choice.id,
      p_interval: interval,
      p_name: name,
      p_phone: phone,
    })
    if (err) setError(explain(err))
    else {
      setChoice(null)
      await reload(['billing'])
      window.scrollTo(0, 0)
    }
    setBusy(false)
  }

  return (
    <>
      <PageHeader title="Abonnement" back="/equipe">
        <p className="page-sub">{stateSentence(billing)}</p>
      </PageHeader>

      <section className="panel">
        <h2>Offre {current?.name}</h2>
        <dl className="usage">
          <Usage
            label="Expéditions en cours"
            used={billing.usage.active_shipments}
            limit={current?.limits.active_shipments}
          />
          <Usage label="Utilisateurs" used={billing.usage.members} limit={current?.limits.members} />
        </dl>
      </section>

      {billing.request && (
        <OpenRequest
          request={billing.request}
          planName={planOf(billing, billing.request.plan_id)?.name ?? ''}
          whatsapp={billing.support_whatsapp}
          orgName={org.name}
          isAdmin={isAdmin}
        />
      )}

      <section className="section">
        <div className="plans-head">
          <h2>Offres</h2>
          <div className="segmented" role="group" aria-label="Période de facturation">
            {(['month', 'year'] as const).map((i) => (
              <button key={i} type="button" aria-pressed={interval === i} onClick={() => setInterval(i)}>
                {i === 'month' ? 'Mensuel' : 'Annuel'}
              </button>
            ))}
          </div>
        </div>
        {interval === 'year' && <p className="muted small">Annuel : deux mois offerts.</p>}
        <div className="plans">
          {billing.plans.map((p) => {
            const price = p.prices[interval]
            const isCurrent = p.id === billing.plan_id && billing.state !== 'trial'
            return (
              <article key={p.id} className={`plan${p.id === billing.plan_id ? ' plan-current' : ''}`}>
                <h3>{p.name}</h3>
                <p className="plan-price">
                  {price ? (
                    <>
                      <strong>{fcfa(price)}</strong> {INTERVAL_LABEL[interval]}
                    </>
                  ) : (
                    <strong>Gratuit</strong>
                  )}
                </p>
                <p className="muted small">{p.description}</p>
                <ul className="plan-features">
                  {p.features.map((f) => (
                    <li key={f}>
                      <Icon name="check" size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
                {price ? (
                  isAdmin && (
                    <button
                      type="button"
                      className={`btn${choice?.id === p.id ? '' : ' btn-primary'}`}
                      onClick={() => {
                        setChoice(choice?.id === p.id ? null : p)
                        setError('')
                      }}
                    >
                      {choice?.id === p.id ? 'Annuler' : isCurrent ? 'Renouveler' : 'Choisir cette offre'}
                    </button>
                  )
                ) : (
                  <p className="muted small">
                    {p.id === billing.plan_id ? 'Votre offre actuelle.' : 'Appliquée automatiquement sans abonnement.'}
                  </p>
                )}
                {choice?.id === p.id && price && (
                  <form className="plan-form" onSubmit={request}>
                    <p>
                      {p.name}, {fcfa(price)} {INTERVAL_LABEL[interval]}. Vous recevrez un lien de paiement Mobile
                      Money.
                    </p>
                    <Field label="Votre nom">
                      <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                    </Field>
                    <Field label="Téléphone (WhatsApp)" hint="Avec l’indicatif, par exemple +237 6 12 34 56 78.">
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="tel"
                        required
                      />
                    </Field>
                    {error && <Notice>{error}</Notice>}
                    <button className="btn btn-primary" disabled={busy}>
                      {busy ? 'Un instant…' : 'Demander le lien de paiement'}
                    </button>
                  </form>
                )}
              </article>
            )
          })}
        </div>
        {!isAdmin && <p className="muted small team-note">Seul un administrateur peut changer d’offre.</p>}
      </section>
    </>
  )
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | undefined }) {
  const over = limit != null && used > limit
  return (
    <div className={over ? 'usage-over' : ''}>
      <dt>{label}</dt>
      <dd>
        <strong>{used}</strong> {limit == null ? '· illimité' : `sur ${limit}`}
        {over && <span> · au-delà de l’offre : les nouvelles créations sont bloquées</span>}
      </dd>
    </div>
  )
}

function OpenRequest({
  request: r,
  planName,
  whatsapp,
  orgName,
  isAdmin,
}: {
  request: PaymentRequest
  planName: string
  whatsapp: string
  orgName: string
  isAdmin: boolean
}) {
  const { reload } = useStore()
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const summary = `${planName}, ${fcfa(r.amount)} ${INTERVAL_LABEL[r.billing_interval]}`
  const contact = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Bonjour, je souhaite payer l’offre ${summary} pour ${orgName} sur NUMERA Import-Export.`)}`
    : ''

  async function run(call: PromiseLike<{ error: unknown }>) {
    setBusy(true)
    setError('')
    const { error: err } = await call
    if (err) setError(explain(err))
    else await reload(['billing'])
    setBusy(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(supabase.rpc('submit_payment_reference', { p_request: r.id, p_ref: ref }))
  }

  return (
    <section className="panel pay">
      <h2>Paiement en cours</h2>
      <p className="pay-summary">{summary}</p>

      {r.status === 'awaiting_link' && (
        <>
          <p>Nous préparons votre lien de paiement. Il apparaîtra ici dès qu’il sera prêt.</p>
          {contact && (
            <a className="btn" href={contact} target="_blank" rel="noreferrer">
              Nous écrire sur WhatsApp
            </a>
          )}
        </>
      )}

      {r.status === 'link_sent' && (
        <>
          {r.rejection_reason && <Notice>{r.rejection_reason} Vérifiez la référence puis renvoyez-la.</Notice>}
          <ol className="pay-steps">
            <li>
              <span>Payez par Mobile Money avec ce lien.</span>
              <a className="btn btn-primary" href={r.payment_link ?? '#'} target="_blank" rel="noreferrer">
                Payer {fcfa(r.amount)}
              </a>
            </li>
            <li>
              <span>Saisissez la référence de la transaction reçue par SMS.</span>
              <form className="pay-ref" onSubmit={submit}>
                <input
                  aria-label="Référence de la transaction"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  minLength={4}
                  required
                />
                <button className="btn" disabled={busy}>
                  Envoyer
                </button>
              </form>
            </li>
          </ol>
        </>
      )}

      {r.status === 'reference_submitted' && (
        <Notice kind="ok">
          Référence {r.transaction_ref} reçue. Nous vérifions votre paiement : votre offre sera activée dès la
          validation.
        </Notice>
      )}

      {error && <Notice>{error}</Notice>}
      {isAdmin && r.status !== 'reference_submitted' && (
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={() => run(supabase.rpc('cancel_payment_request', { p_request: r.id }))}
        >
          Annuler la demande
        </button>
      )}
    </section>
  )
}

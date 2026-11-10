import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Empty, Field, Icon, Notice, PageHeader } from '../components/ui.tsx'
import { fcfa, fullDate } from '../lib/format.ts'
import { useStore } from '../lib/store.tsx'
import { explain, supabase } from '../lib/supabase.ts'
import type { BillingInterval, PaymentRequest, Plan } from '../lib/types.ts'

interface AdminRequest extends PaymentRequest {
  organization_name: string
}

interface PlanLink {
  plan_id: string
  billing_interval: BillingInterval
  url: string
  expires_at: string
}

interface Overview {
  requests: AdminRequest[]
  links: PlanLink[]
  plans: Plan[]
  organizations: number
  active_subscriptions: number
  support_whatsapp: string
  link_validity_days: number
}

const INTERVALS: BillingInterval[] = ['month', 'year']
const INTERVAL_LABEL: Record<BillingInterval, string> = { month: 'mensuel', year: 'annuel' }
const STATUS_LABEL: Record<PaymentRequest['status'], string> = {
  awaiting_link: 'Attend un lien de paiement',
  link_sent: 'Lien envoyé, en attente du paiement',
  reference_submitted: 'Référence à vérifier',
}

/** Réservé au propriétaire de la plateforme : liens de paiement et validation des paiements. */
export default function Platform() {
  const { billing, reload } = useStore()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data: d, error: err } = await supabase.rpc('admin_overview')
    if (err) setError(explain(err))
    else setData(d as Overview)
  }, [])

  useEffect(() => {
    if (billing.is_platform_admin) void load()
  }, [billing.is_platform_admin, load])

  async function run(call: PromiseLike<{ error: unknown; data?: unknown }>, done: (result: unknown) => string) {
    setBusy(true)
    setError('')
    setNotice('')
    const { error: err, data: result } = await call
    if (err) setError(explain(err))
    else {
      setNotice(done(result))
      await Promise.all([load(), reload(['billing'])])
    }
    setBusy(false)
  }

  if (!billing.is_platform_admin)
    return (
      <>
        <PageHeader title="Plateforme" back="/equipe" />
        <Empty title="Cet écran est réservé au propriétaire de la plateforme." />
      </>
    )

  return (
    <>
      <PageHeader title="Plateforme" back="/equipe">
        {data && (
          <p className="page-sub">
            {data.organizations} entreprise{data.organizations > 1 ? 's' : ''} · {data.active_subscriptions}{' '}
            abonnement{data.active_subscriptions > 1 ? 's' : ''} payant{data.active_subscriptions > 1 ? 's' : ''}
          </p>
        )}
      </PageHeader>

      {error && <Notice>{error}</Notice>}
      {notice && <Notice kind="ok">{notice}</Notice>}

      <section className="panel">
        <h2>Paiements à traiter</h2>
        {!data ? (
          <p className="muted" role="status">
            Chargement…
          </p>
        ) : data.requests.length === 0 ? (
          <p className="muted">Aucune demande en attente.</p>
        ) : (
          <ul className="plain requests">
            {data.requests.map((r) => (
              <li key={r.id}>
                <p>
                  <strong>{r.organization_name}</strong>
                  <span>
                    {data.plans.find((p) => p.id === r.plan_id)?.name} {INTERVAL_LABEL[r.billing_interval]} ·{' '}
                    {fcfa(r.amount)}
                  </span>
                  <span>
                    {r.contact_name} ·{' '}
                    <a
                      href={`https://wa.me/${(r.contact_phone ?? '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.contact_phone}
                    </a>{' '}
                    · demandé le {fullDate(r.created_at)}
                  </span>
                  <span className={r.status === 'reference_submitted' ? 'count-missing' : ''}>
                    {STATUS_LABEL[r.status]}
                    {r.transaction_ref ? ` : ${r.transaction_ref}` : ''}
                  </span>
                </p>
                {r.status !== 'awaiting_link' && (
                  <div className="doc-actions">
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Valider le paiement de ${r.organization_name} (${fcfa(r.amount)}) ?`))
                          void run(supabase.rpc('admin_validate_payment', { p_request: r.id }), (end) =>
                            `Paiement validé : ${r.organization_name} est actif jusqu’au ${fullDate(String(end))}.`,
                          )
                      }}
                    >
                      <Icon name="check" />
                      Valider
                    </button>
                    {r.status === 'reference_submitted' && (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Motif du refus (visible par le client) :', 'Nous ne retrouvons pas ce paiement.')
                          if (reason !== null)
                            void run(
                              supabase.rpc('admin_reject_payment', { p_request: r.id, p_reason: reason }),
                              () => 'Référence refusée : le client peut en saisir une autre.',
                            )
                        }}
                      >
                        Refuser
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && (
        <section className="panel">
          <h2>Liens de paiement</h2>
          <p className="muted small">
            Un lien par offre et par période. Il est remis automatiquement à chaque client qui choisit cette offre,
            pendant {data.link_validity_days} jours ; enregistrez-le de nouveau pour le prolonger ou le remplacer.
          </p>
          {data.plans
            .filter((p) => p.prices.month)
            .flatMap((p) =>
              INTERVALS.map((i) => (
                <LinkForm
                  key={`${p.id}-${i}`}
                  label={`${p.name} ${INTERVAL_LABEL[i]} · ${fcfa(p.prices[i] ?? 0)}`}
                  link={data.links.find((l) => l.plan_id === p.id && l.billing_interval === i)}
                  busy={busy}
                  onSave={(url) =>
                    run(supabase.rpc('admin_set_plan_link', { p_plan: p.id, p_interval: i, p_url: url }), (n) =>
                      Number(n) > 0
                        ? `Lien enregistré et remis à ${n} demande${Number(n) > 1 ? 's' : ''} en attente.`
                        : 'Lien enregistré.',
                    )
                  }
                />
              )),
            )}
        </section>
      )}

      {data && (
        <WhatsappForm
          value={data.support_whatsapp}
          busy={busy}
          onSave={(phone) =>
            run(supabase.rpc('admin_set_support_whatsapp', { p_phone: phone }), () => 'Numéro enregistré.')
          }
        />
      )}
    </>
  )
}

function LinkForm({
  label,
  link,
  busy,
  onSave,
}: {
  label: string
  link: PlanLink | undefined
  busy: boolean
  onSave: (url: string) => void
}) {
  const [url, setUrl] = useState(link?.url ?? '')
  const expired = link ? new Date(link.expires_at) < new Date() : false
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave(url)
  }
  return (
    <form className="link-form" onSubmit={submit}>
      <Field
        label={label}
        hint={
          !link
            ? 'Aucun lien : les clients attendent.'
            : expired
              ? `Expiré le ${fullDate(link.expires_at)} : les clients attendent.`
              : `Valable jusqu’au ${fullDate(link.expires_at)}.`
        }
      >
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </Field>
      <button className="btn" disabled={busy}>
        Enregistrer
      </button>
    </form>
  )
}

function WhatsappForm({ value, busy, onSave }: { value: string; busy: boolean; onSave: (phone: string) => void }) {
  const [phone, setPhone] = useState(value)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave(phone)
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Contact WhatsApp</h2>
      <Field
        label="Numéro affiché aux clients qui attendent un lien"
        hint="Avec l’indicatif pays, sans le +. Laissez vide pour ne rien afficher."
      >
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <button className="btn" disabled={busy}>
        Enregistrer
      </button>
    </form>
  )
}

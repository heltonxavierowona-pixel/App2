import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Field, Icon, Notice, PageHeader } from '../components/ui.tsx'
import { planOf, stateSentence } from '../lib/billing.ts'
import { fullDate } from '../lib/format.ts'
import { useStore } from '../lib/store.tsx'
import { explain, supabase } from '../lib/supabase.ts'
import type { Role } from '../lib/types.ts'

interface Member {
  user_id: string
  email: string
  role: Role
  joined_at: string
}

interface Pending {
  id: string
  email: string
  role: Role
  created_at: string
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrateur', member: 'Membre' }

export default function Team() {
  const { org, role, session, billing, reload } = useStore()
  const isAdmin = role === 'admin'
  const [members, setMembers] = useState<Member[] | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invited, setInvited] = useState('')

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase.rpc('list_members'),
      // La RLS ne renvoie les invitations qu'aux administrateurs.
      supabase.from('invitations').select('id, email, role, created_at').order('created_at'),
    ])
    if (m.error || p.error) return setError(explain(m.error ?? p.error))
    setMembers(m.data as Member[])
    setPending(p.data as Pending[])
    void reload(['billing'])
  }, [reload])

  useEffect(() => {
    void load()
  }, [load])

  const shareText = (to: string) =>
    `Bonjour, je vous invite à rejoindre ${org.name} sur NUMERA Import-Export. ` +
    `Créez votre compte avec l’adresse ${to} ici : ${window.location.origin}`

  async function invite(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInvited('')
    const address = email.trim().toLowerCase()
    const { error: err } = await supabase.rpc('invite_member', { p_email: address, p_role: newRole })
    if (err) setError(explain(err))
    else {
      setInvited(address)
      setEmail('')
      await load()
    }
    setBusy(false)
  }

  async function cancel(inv: Pending) {
    setError('')
    const { error: err } = await supabase.from('invitations').delete().eq('id', inv.id)
    if (err) setError(explain(err))
    else await load()
  }

  async function remove(member: Member) {
    if (!window.confirm(`Retirer ${member.email} de l’entreprise ? Cette personne n’aura plus accès aux données.`)) return
    setError('')
    const { error: err } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', org.id)
      .eq('user_id', member.user_id)
    if (err) setError(explain(err))
    else await load()
  }

  return (
    <>
      <PageHeader title="Équipe">
        <p className="page-sub">
          {org.name} · {org.country}
        </p>
      </PageHeader>

      <div className="link-cards team-links">
        <a className="row" href="#/abonnement">
          <div className="row-main">
            <strong>Abonnement · offre {planOf(billing)?.name}</strong>
            <p className="row-sub">{stateSentence(billing)}</p>
          </div>
          <Icon name="chevron" size={18} />
        </a>
        {billing.is_platform_admin && (
          <a className="row" href="#/plateforme">
            <div className="row-main">
              <strong>Plateforme</strong>
              <p className="row-sub">Liens de paiement et paiements à valider</p>
            </div>
            <Icon name="chevron" size={18} />
          </a>
        )}
      </div>

      <section className="panel">
        <h2>Membres</h2>
        {members === null ? (
          <p className="muted" role="status">
            Chargement…
          </p>
        ) : (
          <ul className="plain people">
            {members.map((m) => (
              <li key={m.user_id}>
                <div>
                  <strong>{m.email}</strong>
                  <span>
                    {ROLE_LABEL[m.role]}
                    {m.user_id === session.user.id ? ' · vous' : ` · depuis le ${fullDate(m.joined_at)}`}
                  </span>
                </div>
                {isAdmin && m.user_id !== session.user.id && (
                  <button className="btn-icon" onClick={() => remove(m)} aria-label={`Retirer ${m.email}`}>
                    <Icon name="trash" size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <>
          <form className="panel form" onSubmit={invite}>
            <h2>Inviter un collègue</h2>
            <p className="muted small">
              Votre collègue crée son compte avec cette adresse, puis rejoint l’entreprise à sa première connexion.
            </p>
            <div className="grid-2">
              <Field label="E-mail du collègue">
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Rôle" hint="L’administrateur peut aussi gérer l’équipe.">
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  <option value="member">Membre</option>
                  <option value="admin">Administrateur</option>
                </select>
              </Field>
            </div>
            {invited && (
              <Notice kind="ok">
                Invitation enregistrée pour {invited}. Prévenez votre collègue :{' '}
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText(invited))}`} target="_blank" rel="noreferrer">
                  envoyer le lien par WhatsApp
                </a>
              </Notice>
            )}
            <button className="btn btn-primary" disabled={busy}>
              <Icon name="plus" />
              {busy ? 'Un instant…' : 'Inviter'}
            </button>
          </form>

          {pending.length > 0 && (
            <section className="panel">
              <h2>Invitations en attente</h2>
              <ul className="plain people">
                {pending.map((inv) => (
                  <li key={inv.id}>
                    <div>
                      <strong>{inv.email}</strong>
                      <span>
                        {ROLE_LABEL[inv.role]} · invité le {fullDate(inv.created_at)}
                      </span>
                    </div>
                    <a
                      className="btn-icon btn-icon-plain"
                      href={`https://wa.me/?text=${encodeURIComponent(shareText(inv.email))}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Envoyer le lien à ${inv.email} par WhatsApp`}
                    >
                      <Icon name="share" size={18} />
                    </a>
                    <button className="btn-icon" onClick={() => cancel(inv)} aria-label={`Annuler l’invitation de ${inv.email}`}>
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="muted small team-note">Seul un administrateur peut inviter ou retirer un collègue.</p>
      )}
      {error && <Notice>{error}</Notice>}
    </>
  )
}

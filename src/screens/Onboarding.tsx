import { useState } from 'react'
import type { FormEvent } from 'react'
import { Field, Notice } from '../components/ui.tsx'
import { COUNTRIES } from '../lib/constants.ts'
import { explain, supabase } from '../lib/supabase.ts'

export function Onboarding({ email, onDone }: { email: string; onDone: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('Côte d’Ivoire')
  const [demo, setDemo] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currency = COUNTRIES.find((c) => c.name === country)?.currency ?? 'XOF'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('create_organization', {
      p_name: name,
      p_country: country,
      p_currency: currency,
      p_with_demo: demo,
    })
    if (err) {
      setError(explain(err))
      setBusy(false)
    } else await onDone()
  }

  return (
    <div className="auth">
      <div className="auth-intro hero">
        <p className="auth-brand">
          <img src="/numera-mark.svg" alt="" width="52" height="52" />
          <span>NUMERA</span>
        </p>
        <h1>
          Bienvenue. Présentez-nous <em>votre entreprise.</em>
        </h1>
        <p>Vos données restent privées : seuls les membres de votre entreprise y ont accès.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <h2>Votre entreprise</h2>
        <Field label="Nom de l’entreprise">
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required />
        </Field>
        <Field
          label="Pays"
          hint={`Montants en FCFA (${currency === 'XOF' ? 'UEMOA' : 'CEMAC'}), convertis depuis l’euro, le dollar et le yuan.`}
        >
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <label className="check">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>
            Charger des données de démonstration
            <small>Sept commandes et huit expéditions fictives pour découvrir l’application.</small>
          </span>
        </label>
        {error && <Notice>{error}</Notice>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Création…' : 'Commencer'}
        </button>
        <p className="auth-switch">
          Connecté en tant que {email}.{' '}
          <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
            Se déconnecter
          </button>
        </p>
      </form>
    </div>
  )
}

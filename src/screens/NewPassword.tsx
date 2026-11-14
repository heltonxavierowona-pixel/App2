import { useState } from 'react'
import type { FormEvent } from 'react'
import { Field, Notice } from '../components/ui.tsx'
import { explain, supabase } from '../lib/supabase.ts'

/** Affiché après un clic sur le lien « mot de passe oublié ». */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(explain(err))
      setBusy(false)
    } else onDone()
  }

  return (
    <div className="auth">
      <div className="auth-intro hero">
        <p className="auth-brand">
          <img src="/numera-mark.svg" alt="" width="52" height="52" />
          <span>NUMERA</span>
        </p>
        <h1>
          Choisissez un <em>nouveau mot de passe.</em>
        </h1>
        <p>Il remplacera l’ancien dès que vous aurez validé.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <h2>Nouveau mot de passe</h2>
        <Field label="Mot de passe" hint="8 caractères au minimum.">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {error && <Notice>{error}</Notice>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Un instant…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}

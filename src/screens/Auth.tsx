import { useState } from 'react'
import type { FormEvent } from 'react'
import { Field, Notice } from '../components/ui.tsx'
import { explain, supabase } from '../lib/supabase.ts'

export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const creds = { email: email.trim(), password }
    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword(creds)
      if (err) setError(explain(err))
    } else {
      // Le lien de confirmation doit ramener sur cette application, pas sur l'URL par défaut du projet.
      const { data, error: err } = await supabase.auth.signUp({
        ...creds,
        options: { emailRedirectTo: window.location.origin },
      })
      if (err) setError(explain(err))
      else if (!data.session) setSent(true)
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <div className="auth-intro">
        <p className="brand-mark">NUMERA</p>
        <h1>Vos importations et exportations, du bon de commande à la livraison.</h1>
        <p>Commandes, conteneurs, pièces de dossier et coût de revient au même endroit, en FCFA.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        {sent ? (
          <Notice kind="ok">
            Compte créé. Ouvrez le lien de confirmation envoyé à {email}, puis connectez-vous.
          </Notice>
        ) : (
          <>
            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
              />
            </Field>
            <Field label="Mot de passe" hint={mode === 'signup' ? '6 caractères au minimum.' : undefined}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </Field>
            {error && <Notice>{error}</Notice>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </>
        )}
        <p className="auth-switch">
          {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà inscrit ?'}{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setSent(false)
            }}
          >
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
      </form>
    </div>
  )
}

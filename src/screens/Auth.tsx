import { useState } from 'react'
import type { FormEvent } from 'react'
import { Field, Notice } from '../components/ui.tsx'
import { explain, supabase } from '../lib/supabase.ts'

export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function switchTo(next: typeof mode) {
    setMode(next)
    setError('')
    setSent(false)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const creds = { email: email.trim(), password }
    if (mode === 'forgot') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(creds.email, {
        redirectTo: window.location.origin,
      })
      if (err) setError(explain(err))
      else setSent(true)
    } else if (mode === 'login') {
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
      <div className="auth-intro hero">
        <p className="auth-brand">
          <img src="/numera-mark.svg" alt="" width="52" height="52" />
          <span>NUMERA</span>
        </p>
        <h1>
          Chaque conteneur suivi, du bon de commande <em>à la livraison.</em>
        </h1>
        <p>Commandes, conteneurs, pièces de dossier et coût de revient au même endroit, en FCFA.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <h2>
          {mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié'}
        </h2>
        {sent ? (
          <Notice kind="ok">
            {mode === 'forgot'
              ? `Si un compte existe pour ${email}, un lien pour choisir un nouveau mot de passe vient d’être envoyé.`
              : `Compte créé. Ouvrez le lien de confirmation envoyé à ${email}, puis connectez-vous.`}
          </Notice>
        ) : (
          <>
            {mode === 'forgot' && (
              <p className="muted">Indiquez votre e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
            )}
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
            {mode !== 'forgot' && (
              <Field label="Mot de passe" hint={mode === 'signup' ? '8 caractères au minimum.' : undefined}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signup' ? 8 : 6}
                  required
                />
              </Field>
            )}
            {error && <Notice>{error}</Notice>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy
                ? 'Un instant…'
                : mode === 'login'
                  ? 'Se connecter'
                  : mode === 'signup'
                    ? 'Créer mon compte'
                    : 'Envoyer le lien'}
            </button>
          </>
        )}
        {mode === 'login' && (
          <p className="auth-switch">
            <button type="button" className="link" onClick={() => switchTo('forgot')}>
              Mot de passe oublié ?
            </button>
          </p>
        )}
        <p className="auth-switch">
          {mode === 'login' ? 'Pas encore de compte ?' : mode === 'signup' ? 'Déjà inscrit ?' : 'Vous vous en souvenez ?'}{' '}
          <button type="button" className="link" onClick={() => switchTo(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
      </form>
    </div>
  )
}

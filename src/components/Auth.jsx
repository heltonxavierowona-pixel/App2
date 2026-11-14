import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Field, Tabs } from '../ui.jsx';
import Logo from './Logo.jsx';

function ShopFields({ f, set }) {
  return (
    <>
      <Field label="Nom de la boutique"
        hint="Ce nom figurera sur toutes vos factures. Il est enregistré à l'ouverture du compte et ne pourra plus être modifié.">
        <input required maxLength={80} value={f.shopName} onChange={set('shopName')} placeholder="ex. Boutique Awa Mode" />
      </Field>
      <Field label="Devise"><input value={f.currency} onChange={set('currency')} placeholder="FCFA" /></Field>
    </>
  );
}

export function AuthScreen() {
  const { auth, cloudEnabled, notify } = useStore();
  const [mode, setMode] = useState('signup'); // signup | login
  const [online, setOnline] = useState(cloudEnabled);
  const [invited, setInvited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ name: '', shopName: '', currency: 'FCFA', email: '', password: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!online) await auth.openLocal(f);
      else if (mode === 'login') await auth.signIn(f);
      else {
        const { needsConfirmation } = await auth.signUp(invited ? { ...f, shopName: '' } : f);
        if (needsConfirmation) setSent(true);
      }
    } catch (err) { notify(err.message, 'error'); }
    setBusy(false);
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <Logo size={34} stacked />
        <p className="muted center">Le gestionnaire intelligent des petits commerces</p>

        {sent ? (
          <div className="note">
            <strong>Vérifiez votre boîte e-mail.</strong>
            <p>Un lien de confirmation a été envoyé à {f.email}. Ouvrez-le, puis connectez-vous :
              votre boutique sera créée automatiquement.</p>
            <button className="btn primary big" onClick={() => { setSent(false); setMode('login'); }}>Se connecter</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {online && <Tabs value={mode} onChange={setMode} options={[['signup', 'Ouvrir un compte'], ['login', 'Se connecter']]} />}
            {(mode === 'signup' || !online) && (
              <>
                <Field label="Votre nom"><input required autoFocus value={f.name} onChange={set('name')} /></Field>
                {online && (
                  <label className="check">
                    <input type="checkbox" checked={invited} onChange={(e) => setInvited(e.target.checked)} />
                    <span>Je suis vendeur : un patron m'a invité dans sa boutique</span>
                  </label>
                )}
                {!(online && invited) && <ShopFields f={f} set={set} />}
              </>
            )}
            {online && (
              <>
                <Field label="E-mail"><input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
                <Field label="Mot de passe" hint={mode === 'signup' ? 'Au moins 6 caractères' : null}>
                  <input type="password" required minLength={6} value={f.password} onChange={set('password')}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                </Field>
              </>
            )}
            <button className="btn primary big" type="submit" disabled={busy}>
              {busy ? 'Un instant…' : mode === 'login' && online ? 'Se connecter' : 'Ouvrir mon compte'}
            </button>
            {cloudEnabled && (
              <button type="button" className="link center" onClick={() => { setOnline(!online); setMode('signup'); }}>
                {online ? 'Utiliser sans compte en ligne (cet appareil seulement)' : 'Créer un compte en ligne (plusieurs appareils)'}
              </button>
            )}
            {!online && (
              <p className="muted small">
                Sans compte en ligne, vos données restent sur cet appareil : pensez à télécharger une sauvegarde régulièrement.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export function NoShopScreen() {
  const { auth, notify, session } = useStore();
  const [f, setF] = useState({ shopName: '', currency: 'FCFA' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { await auth.createShop({ name: f.shopName, currency: f.currency }); } catch (err) { notify(err.message, 'error'); }
  };
  return (
    <div className="auth">
      <div className="auth-card">
        <Logo size={34} stacked />
        <p className="note">
          Aucune boutique n'est rattachée à {session?.email}. Si un patron vous a invité, vérifiez qu'il a bien saisi
          cette adresse. Sinon, créez votre boutique.
        </p>
        <form onSubmit={submit}>
          <ShopFields f={f} set={set} />
          <button className="btn primary big" type="submit">Créer ma boutique</button>
          <button type="button" className="link center" onClick={auth.signOut}>Se déconnecter</button>
        </form>
      </div>
    </div>
  );
}

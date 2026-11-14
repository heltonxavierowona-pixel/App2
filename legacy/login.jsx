import React, { useState } from 'react';
import { login } from '../api';

export default function Login({ onAuth }){
  const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
      const [err, setErr] = useState('');

        const submit = async (e) => {
            e.preventDefault();
                try{
                      const res = await login({ email, password });
                            onAuth(res.data.token);
                                } catch (e) {
                                      setErr(e.response?.data?.msg || 'Erreur connexion');
                                          }
                                            };

                                              return (
                                                  <form className="card" onSubmit={submit}>
                                                       <h3>Se connecter</h3>
                                                              {err && <div className="error">{err}</div>}
                                                                    <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
                                                                          <input placeholder="Mot de passe" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
                                                                                <button type="submit">Se connecter</button>
                                                                                    </form>
                                                                                      );
                                                                                      }
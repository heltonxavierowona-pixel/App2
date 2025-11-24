import React, { useState } from 'react';
import { register } from '../api';

export default function Register({ onAuth }){
  const [name, setName] = useState('');
    const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
        const [err, setErr] = useState('');

          const submit = async (e) => {
              e.preventDefault();
                  try{
                        const res = await register({ name, email, password });
                              onAuth(res.data.token);
                                  } catch (e) {
                                        setErr(e.response?.data?.msg || 'Erreur inscription');
                                            }
                                              };

                                                return (
                                                    <form className="card" onSubmit={submit}>
                                                          <h3>S'inscrire</h3>
                                                                {err && <div className="error">{err}</div>}
                                                                      <input placeholder="Nom" value={name} onChange={e=>setName(e.target.value)} />
                                                                            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
                                                                                  <input placeholder="Mot de passe" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
                                                                                      <button type="submit">Créer compte</button>
                                                                                            </form>
                                                                                              );
                                                                                              }
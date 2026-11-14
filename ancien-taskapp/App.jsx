import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token') || null);

    useEffect(() => {
        if(token) localStorage.setItem('token', token);
            else localStorage.removeItem('token');
              }, [token]);

                if(!token) {
                    return (
                          <div className="auth-wrapper">
                                  <h1>TaskApp</h1>
                                          <div className="auth-forms">
                                                    <Login onAuth={(t)=>setToken(t)} />
                                                              <Register onAuth={(t)=>setToken(t)} />
                                                                      </div>
                                                                            </div>
                                                                                );
                                                                                  }

                                                                                    return <Dashboard onLogout={() => setToken(null)} />;
                                                                                    }
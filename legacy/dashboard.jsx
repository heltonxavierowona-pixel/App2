import React, { useEffect, useState } from 'react';
import { fetchTasks, createTask, updateTask, deleteTask, fetchPerformance } from '../api';
import TaskCard from '../components/TaskCard';

export default function Dashboard({ onLogout }){
  const [tasks, setTasks] = useState([]);
    const [title, setTitle] = useState('');
      const [desc, setDesc] = useState('');
        const [perf, setPerf] = useState([]);

          const load = async () => {
              try {
                    const t = await fetchTasks();
                          setTasks(t.data);
                                const p = await fetchPerformance();
                                      setPerf(p.data);
                                          } catch (e) { console.error(e); }
                                            };

                                              useEffect(()=>{ load(); }, []);

                                                const add = async (e) => {
                                                    e.preventDefault();
                                                        try {
                                                              const res = await createTask({ title, description: desc });
                                                                    setTasks(prev => [res.data, ...prev]);
                                                                          setTitle(''); setDesc('');
                                                                              } catch (e) { console.error(e); }
                                                                                };

                                                                                  const toggleDone = async (task) => {
                                                                                      const newStatus = task.status === 'done' ? 'todo' : 'done';
                                                                                          try {
                                                                                                const res = await updateTask(task._id, { ...task, status: newStatus });
                                                                                                      setTasks(tasks.map(t => t._id === task._1 ? res.data : (t._id === task._id ? res.data : t)));
                                                                                                            await load(); // refresh performance
                                                                                                                } catch (e) { console.error(e); }
                                                                                                                  };

                                                                                                                    const remove = async (id) => {
                                                                                                                        try {
                                                                                                                              await deleteTask(id);
                                                                                                                                    setTasks(tasks.filter(t => t._id !== id));
                                                                                                                                        } catch (e) { console.error(e); }
                                                                                                                                          };

                                                                                                                                            const completedCount = tasks.filter(t => t.status === 'done').length;

                                                                                                                                              return (
                                                                                                                                                  <div className="dashboard">
                                                                                                                                                        <header>
                                                                                                                                                                 <h2>Dashboard</h2>
                                                                                                                                                                        <div>
                                                                                                                                                                                  <span>Score: {perf.reduce((s,p)=>s+p.score,0)}</span>
                                                                                                                                                                                            <button onClick={onLogout}>Se déconnecter</button>
                                                                                                                                                                                                    </div>
                                                                                                                                                                                                          </header>

                                                                                                                                                                                                                <section className="create">
                                                                                                                                                                                                                        <form onSubmit={add}>
                                                                                                                                                                                                                                  <input placeholder="Titre tâche" value={title} onChange={e=>setTitle(e.target.value)} required/>
                                                                                                                                                                                                                                            <input placeholder="Description (optionnel)" value={desc} onChange={e=>setDesc(e.target.value)} />
                                                                                                                                                                                                                                                      <button type="submit">Ajouter</button>
                                                                                                                                                                                                                                                              </form>
                                                                                                                                                                                                                                                                    </section>

                                                                                                                                                                                                                                                                          <section className="lists">
                                                                                                                                                                                                                                                                                  <div className="column">
                                                                                                                                                                                                                                                                                            <h3>To do</h3>
                                                                                                                                                                                                                                                                                                      {tasks.filter(t=>t.status==='todo').map(t => <TaskCard key={t._id} task={t} onToggle={toggleDone} onDelete={remove} />)}
                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                      <div className="column">
                                                                                                                                                                                                                                                                                                                                <h3>In progress</h3>
                                                                                                                                                                                                                                                                                                                                          {tasks.filter(t=>t.status==='in_progress').map(t => <TaskCard key={t._id} task={t} onToggle={toggleDone} onDelete={remove} />)}
                                                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                                                          <div className="column">
                                                                                                                                                                                                                                                                                                                                                                    <h3>Done</h3>
                                                                                                                                                                                                                                                                                                                                                                              {tasks.filter(t=>t.status==='done').map(t => <TaskCard key={t._id} task={t} onToggle={toggleDone} onDelete={remove} />)}
                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                                                            </section>

                                                                                                                                                                                                                                                                                                                                                                                                  <footer>
                                                                                                                                                                                                                                                                                                                                                                                                          <div>Tâches totales: {tasks.length} — Terminées: {completedCount}</div>
                                                                                                                                                                                                                                                                                                                                                                                                                </footer>
                                                                                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                                                                      );
                                                                                                                                                                                                                                                                                                                                                                                                                      }
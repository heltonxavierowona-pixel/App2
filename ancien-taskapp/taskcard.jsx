import React from 'react';

export default function TaskCard({ task, onToggle, onDelete }){
  return (
      <div className={`task-card ${task.status}`}>
            <h4>{task.title}</h4>
                  {task.description && <p>{task.description}</p>}
                        <div className="task-actions">
                                <button onClick={()=>onToggle(task)}>{task.status === 'done' ? 'Réouvrir' : 'Terminer'}</button>
                                        <button onClick={()=>onDelete(task._id)}>Suppr</button>
                                              </div>
                                                  </div>
                                                    );
                                                    }
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Performance = require('../models/Performance');

// Create task
router.post('/', auth, async (req, res) => {
  try {
      const { title, description, dueDate, priority } = req.body;
          const task = new Task({
                user: req.user.id,
                      title, description, dueDate, priority
                          });
                              await task.save();
                                  res.json(task);
                                    } catch (err) { res.status(500).send('Server error'); }
                                    });

                                    // Get all tasks for user
                                    router.get('/', auth, async (req, res) => {
                                      try {
                                          const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
                                              res.json(tasks);
                                                } catch (err) { res.status(500).send('Server error'); }
                                                });

                                                // Update task
                                                router.put('/:id', auth, async (req, res) => {
                                                  try {
                                                      const { title, description, status, priority, dueDate } = req.body;
                                                          const task = await Task.findOneAndUpdate(
                                                                { _id: req.params.id, user: req.user.id },
                                                                      { title, description, status, priority, dueDate, updatedAt: Date.now() },
                                                                            { new: true }
                                                                                );
                                                                                    if(!task) return res.status(404).json({ msg: 'Task not found' });

                                                                                        // If marked done, update performance
                                                                                            if(status === 'done') {
                                                                                                  const today = new Date(); today.setHours(0,0,0,0);
                                                                                                        let perf = await Performance.findOne({ user: req.user.id, date: today });
                                                                                                              if(!perf) {
                                                                                                                      perf = new Performance({ user: req.user.id, date: today, tasksCompleted:1, score:1 });
                                                                                                                            } else {
                                                                                                                                    perf.tasksCompleted += 1;
                                                                                                                                            perf.score += 1;
                                                                                                                                                  }
                                                                                                                                                        await perf.save();
                                                                                                                                                            }

                                                                                                                                                                res.json(task);
                                                                                                                                                                  } catch (err) { res.status(500).send('Server error'); }
                                                                                                                                                                  });

                                                                                                                                                                  // Delete task
                                                                                                                                                                  router.delete('/:id', auth, async (req, res) => {
                                                                                                                                                                    try {
                                                                                                                                                                        const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
                                                                                                                                                                            if(!task) return res.status(404).json({ msg: 'Task not found' });
                                                                                                                                                                                res.json({ msg: 'Deleted' });
                                                                                                                                                                                  } catch (err) { res.status(500).send('Server error'); }
                                                                                                                                                                                  });

                                                                                                                                                                                  module.exports = router;
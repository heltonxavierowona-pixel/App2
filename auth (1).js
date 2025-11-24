const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
      const { name, email, password } = req.body;
          if(!name || !email || !password) return res.status(400).json({ msg: 'Missing fields' });
              let user = await User.findOne({ email });
                  if(user) return res.status(400).json({ msg: 'User already exists' });

                      const salt = await bcrypt.genSalt(10);
                          const passwordHash = await bcrypt.hash(password, salt);

                              user = new User({ name, email, passwordHash });
                                  await user.save();

                                      const payload = { user: { id: user.id } };
                                          jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
                                                if(err) throw err;
                                                      res.json({ token });
                                                          });
                                                            } catch (err) {
                                                                res.status(500).send('Server error');
                                                                  }
                                                                  });

                                                                  // Login
                                                                  router.post('/login', async (req, res) => {
                                                                    try {
                                                                        const { email, password } = req.body;
                                                                            if(!email || !password) return res.status(400).json({ msg: 'Missing fields' });
                                                                                const user = await User.findOne({ email });
                                                                                    if(!user) return res.status(400).json({ msg: 'Invalid credentials' });
                                                                                        const isMatch = await bcrypt.compare(password, user.passwordHash);
                                                                                            if(!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

                                                                                                const payload = { user: { id: user.id } };
                                                                                                    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
                                                                                                          if(err) throw err;
                                                                                                                res.json({ token });
                                                                                                                    });
                                                                                                                      } catch (err) {
                                                                                                                          res.status(500).send('Server error');
                                                                                                                            }
                                                                                                                            });

                                                                                                                            module.exports = router;
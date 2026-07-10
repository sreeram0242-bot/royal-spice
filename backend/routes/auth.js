const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../db');

// Master Login
router.post('/master/login', (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.MASTER_USERNAME && password === process.env.MASTER_PASSWORD) {
    const token = jwt.sign({ role: 'master' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token, message: 'Master login successful' });
  }

  res.status(401).json({ message: 'Invalid master credentials' });
});

// Admin Login
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { adminUsername: username }
    });
    
    if (!restaurant) return res.status(401).json({ message: 'Invalid credentials' });

    if (!restaurant.isActive) {
      return res.status(403).json({ message: 'Service Suspended' });
    }

    const isMatch = await bcrypt.compare(password, restaurant.adminPasswordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { role: 'admin', restaurantId: restaurant.id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, restaurantId: restaurant.id, message: 'Admin login successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Waiter Login
router.post('/waiter/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const waiter = await prisma.waiter.findUnique({
      where: { username }
    });

    if (!waiter) return res.status(401).json({ message: 'Invalid credentials' });
    if (!waiter.isActive) return res.status(403).json({ message: 'Account disabled. Contact admin.' });

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, waiter.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { role: 'waiter', restaurantId: waiter.restaurantId, waiterId: waiter.id, waiterName: waiter.name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, restaurantId: waiter.restaurantId, waiterName: waiter.name, message: 'Login successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

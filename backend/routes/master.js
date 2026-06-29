const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authMaster } = require('../middleware/auth');
const prisma = require('../db');

// Get all restaurants
router.get('/restaurants', authMaster, async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new restaurant
router.post('/restaurants', authMaster, async (req, res) => {
  try {
    const { name, ownerName, phone, email, address, logo, plan, trialDays, adminUsername, adminPassword } = req.body;

    const existing = await prisma.restaurant.findUnique({
      where: { adminUsername }
    });
    if (existing) {
      return res.status(400).json({ message: 'Admin username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(adminPassword, salt);

    const actualPlan = plan || 'trial';
    const actualTrialDays = trialDays || 14;
    
    let trialStartDate = new Date();
    let subscriptionExpiry = null;
    
    if (actualPlan === 'trial') {
      subscriptionExpiry = new Date(trialStartDate.getTime() + (actualTrialDays * 24 * 60 * 60 * 1000));
    }

    const newRestaurant = await prisma.restaurant.create({
      data: {
        name,
        address,
        logo,
        adminUsername,
        adminPasswordHash,
        plan: actualPlan,
        trialDays: actualTrialDays,
        trialStartDate,
        subscriptionExpiry,
        paymentStatus: actualPlan === 'trial' ? 'trial' : 'unpaid',
        isActive: true
      }
    });

    res.status(201).json({ message: 'Restaurant created successfully', restaurant: newRestaurant });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Suspend or Restore restaurant
router.put('/restaurants/:id/status', authMaster, async (req, res) => {
  try {
    const { isActive } = req.body;
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: { isActive }
    });
    res.json({ message: 'Restaurant status updated', restaurant });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit restaurant details
router.put('/restaurants/:id', authMaster, async (req, res) => {
  try {
    const { name, plan, trialDays, subscriptionExpiry } = req.body;
    let data = {};
    if (name) data.name = name;
    if (plan) data.plan = plan;
    if (trialDays !== undefined) data.trialDays = parseInt(trialDays);
    if (subscriptionExpiry) data.subscriptionExpiry = new Date(subscriptionExpiry);
    
    const updated = await prisma.restaurant.update({
      where: { id: req.params.id },
      data
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get restaurant stats
router.get('/restaurants/:id/stats', authMaster, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: req.params.id }
    });
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id }
    });
    
    res.json({ totalOrders, totalRevenue, restaurant });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send notification to admin
router.post('/notify', authMaster, async (req, res) => {
  try {
    const { restaurantId, message } = req.body;
    
    const notification = await prisma.masterNotification.create({
      data: { restaurantId, message }
    });

    // Emit via Socket.IO
    const io = req.app.get('io');
    io.to(restaurantId).emit('master_notification', { message, date: notification.createdAt });

    res.json({ message: 'Notification sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all complaints
router.get('/complaints', authMaster, async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      include: {
        restaurant: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map data to match old response format for frontend
    const mapped = complaints.map(c => ({
      ...c,
      restaurantId: { name: c.restaurant.name } // simulate mongoose populate
    }));
    
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reply to complaint
router.put('/complaints/:id/reply', authMaster, async (req, res) => {
  try {
    const { reply } = req.body;
    const complaint = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { reply, status: 'replied' }
    });
    res.json({ message: 'Reply sent', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get aggregated dashboard stats
router.get('/dashboard-stats', authMaster, async (req, res) => {
  try {
    const orders = await prisma.order.findMany();
    const restaurants = await prisma.restaurant.findMany();
    const complaints = await prisma.complaint.findMany();
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const activeRestaurants = restaurants.filter(r => r.isActive).length;
    const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
    
    // Group revenue by date (last 7 days for chart)
    const revenueByDate = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      revenueByDate[dateStr] = 0;
    }
    
    orders.forEach(o => {
      const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
      if (revenueByDate[dateStr] !== undefined) {
        revenueByDate[dateStr] += o.total;
      }
    });

    res.json({
      totalOrders,
      totalRevenue,
      activeRestaurants,
      pendingComplaints,
      chartData: revenueByDate,
      recentRestaurants: restaurants.slice(0, 5), // last 5
      recentComplaints: complaints.slice(0, 5) // last 5
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Global Broadcast
router.post('/broadcast', authMaster, async (req, res) => {
  try {
    const { message } = req.body;
    const io = req.app.get('io');
    
    // Emit to all connected clients (they all join their own restaurantId room, but we can emit globally)
    io.emit('master_broadcast', { message, date: new Date() });
    
    res.json({ message: 'Broadcast sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { v4: uuidv4 } = require('uuid');

// Get restaurant details for customer portal
router.get('/restaurant/:id', async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      select: { name: true, logo: true, gstPercent: true, isActive: true }
    });
    
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    if (!restaurant.isActive) return res.status(403).json({ message: 'Restaurant is currently unavailable' });
    
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get menu for a restaurant
router.get('/menu/:restaurantId', async (req, res) => {
  try {
    const menu = await prisma.menuItem.findMany({
      where: { 
        restaurantId: req.params.restaurantId,
        isAvailable: true 
      }
    });
    res.json(menu);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get category settings for a restaurant
router.get('/categories/:restaurantId', async (req, res) => {
  try {
    const settings = await prisma.categorySetting.findMany({
      where: { restaurantId: req.params.restaurantId }
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Place an order
router.post('/order', async (req, res) => {
  try {
    const { restaurantId, tableNumber, items, subtotal, gst, total, sessionId } = req.body;

    // Generate simple order number
    const count = await prisma.order.count({ where: { restaurantId } });
    const orderNumber = 1000 + count + 1;

    // If sessionId not provided, generate one
    const currentSessionId = sessionId || uuidv4();

    const order = await prisma.order.create({
      data: {
        restaurantId,
        tableNumber,
        orderNumber,
        subtotal,
        gst,
        total,
        status: 'new',
        sessionId: currentSessionId,
        items: {
          create: items.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            qty: item.qty
          }))
        }
      },
      include: { items: true }
    });

    // Emit via Socket.IO to admin
    const io = req.app.get('io');
    io.to(restaurantId).emit('new_order', order);

    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Call Waiter
router.post('/call-waiter', async (req, res) => {
  try {
    const { restaurantId, tableNumber } = req.body;
    
    const call = await prisma.waiterCall.create({
      data: {
        restaurantId,
        tableNumber,
        status: 'pending'
      }
    });

    // Emit via Socket.IO to admin
    const io = req.app.get('io');
    io.to(restaurantId).emit('waiter_call', call);

    res.status(201).json({ message: 'Waiter has been notified' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get order status for a session
router.get('/orders/:sessionId', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { sessionId: req.params.sessionId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { authWaiter } = require('../middleware/auth');
const prisma = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// GET /api/waiter/settings — restaurant info for waiter
router.get('/settings', authWaiter, async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: { name: true, logo: true, address: true, gstPercent: true, totalTables: true, paymentQrCode: true }
    });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/waiter/menu — full menu
router.get('/menu', authWaiter, async (req, res) => {
  try {
    const menu = await prisma.menuItem.findMany({
      where: { restaurantId: req.user.restaurantId, isAvailable: true }
    });
    res.json(menu);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/waiter/tables — all tables with current active orders
router.get('/tables', authWaiter, async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: { totalTables: true }
    });

    // Get all active (non-completed) orders, grouped by table
    const activeOrders = await prisma.order.findMany({
      where: {
        restaurantId: req.user.restaurantId,
        status: { not: 'completed' }
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    // Get pending waiter calls
    const calls = await prisma.waiterCall.findMany({
      where: { restaurantId: req.user.restaurantId, status: 'pending' }
    });

    // Get active passcodes
    const passcodes = await prisma.tablePasscode.findMany({
      where: { restaurantId: req.user.restaurantId }
    });

    const tables = [];
    for (let i = 1; i <= restaurant.totalTables; i++) {
      const tableOrders = activeOrders.filter(o => o.tableNumber === i);
      const hasCall = calls.some(c => c.tableNumber === i);
      const total = tableOrders.reduce((sum, o) => sum + o.total, 0);
      const statuses = tableOrders.map(o => o.status);
      let status = 'available';
      if (tableOrders.length > 0) {
        if (statuses.includes('new')) status = 'new';
        else if (statuses.includes('preparing')) status = 'preparing';
        else if (statuses.includes('ready')) status = 'ready';
        else status = 'occupied';
      }

      let passcodeStr = passcodes.find(p => p.tableNumber === i)?.passcode || null;
      if (!passcodeStr) {
        passcodeStr = Math.floor(1000 + Math.random() * 9000).toString();
        // Since this is just a quick UI fetch, we won't await the DB save to block the UI, 
        // we can just fire and forget or await it. We'll await it for consistency.
        await prisma.tablePasscode.upsert({
          where: { restaurantId_tableNumber: { restaurantId: req.user.restaurantId, tableNumber: i } },
          update: { passcode: passcodeStr },
          create: { restaurantId: req.user.restaurantId, tableNumber: i, passcode: passcodeStr }
        });
      }

      tables.push({
        tableNumber: i,
        status,
        hasCall,
        orderCount: tableOrders.length,
        total,
        sessionId: tableOrders.length > 0 ? tableOrders[0].sessionId : null,
        passcode: passcodeStr
      });
    }

    res.json(tables);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/waiter/table/:num/bill — full bill for a table
router.get('/table/:num/bill', authWaiter, async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.num);
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: { name: true, address: true, gstPercent: true }
    });

    // Get most recent active session for this table
    const latestOrder = await prisma.order.findFirst({
      where: { restaurantId: req.user.restaurantId, tableNumber, status: { not: 'completed' } },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestOrder) {
      return res.status(404).json({ message: 'No active orders for this table' });
    }

    const orders = await prisma.order.findMany({
      where: { sessionId: latestOrder.sessionId, status: { not: 'completed' } },
      include: { items: true },
      orderBy: { createdAt: 'asc' }
    });

    const subtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const gstAmount = subtotal * (restaurant.gstPercent / 100);
    const totalTip = orders.reduce((sum, o) => sum + (o.tip || 0), 0);
    const grandTotal = Math.round(subtotal + gstAmount + totalTip);

    res.json({
      restaurant,
      tableNumber,
      sessionId: latestOrder.sessionId,
      orders,
      subtotal,
      gstAmount,
      gstPercent: restaurant.gstPercent,
      totalTip,
      grandTotal,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// POST /api/waiter/order — place a new order for a table
router.post('/order', authWaiter, async (req, res) => {
  try {
    const { tableNumber, items, subtotal, gst, tip = 0, total, sessionId } = req.body;
    const restaurantId = req.user.restaurantId;

    const count = await prisma.order.count({ where: { restaurantId } });
    const orderNumber = 1000 + count + 1;
    // Enforce single-session per table: always check for an active order first
    let currentSessionId = sessionId;
    let currentSessionNumber = null;
    
    const activeOrder = await prisma.order.findFirst({
      where: { restaurantId, tableNumber: parseInt(tableNumber), status: { not: 'completed' } },
      orderBy: { createdAt: 'desc' }
    });
    
    if (activeOrder) {
      currentSessionId = activeOrder.sessionId;
      currentSessionNumber = activeOrder.sessionNumber;
    } else {
      if (!currentSessionId) currentSessionId = uuidv4();
      const restaurant = await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { sessionCounter: { increment: 1 } }
      });
      currentSessionNumber = restaurant.sessionCounter;
    }

    const order = await prisma.order.create({
      data: {
        restaurantId,
        tableNumber: parseInt(tableNumber),
        orderNumber,
        subtotal: parseFloat(subtotal),
        gst: parseFloat(gst),
        tip: parseFloat(tip),
        total: parseFloat(total),
        status: 'new',
        sessionId: currentSessionId,
        sessionNumber: currentSessionNumber,
        items: {
          create: items.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: parseFloat(item.price),
            qty: parseInt(item.qty),
            specialNote: item.specialNote || null
          }))
        }
      },
      include: { items: true }
    });

    const io = req.app.get('io');
    io.to(restaurantId).emit('new_order', order);

    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/waiter/table/:num/close-session — close a table session
router.post('/table/:num/close-session', authWaiter, async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.num);
    const restaurantId = req.user.restaurantId;

    const { paymentMethod } = req.body;

    // Find latest active session
    const latestOrder = await prisma.order.findFirst({
      where: { restaurantId, tableNumber, status: { not: 'completed' } },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestOrder) {
      return res.status(404).json({ message: 'No active session for this table' });
    }

    await prisma.order.updateMany({
      where: { sessionId: latestOrder.sessionId },
      data: { 
        status: 'completed', 
        paymentMethod: paymentMethod || 'cash',
        closedByWaiter: req.user.name || 'Unknown' 
      }
    });

    // Generate new passcode for the next session
    const newPasscode = Math.floor(1000 + Math.random() * 9000).toString();
    await prisma.tablePasscode.upsert({
      where: { restaurantId_tableNumber: { restaurantId, tableNumber } },
      update: { passcode: newPasscode },
      create: { restaurantId, tableNumber, passcode: newPasscode }
    });

    const io = req.app.get('io');
    io.to(restaurantId).emit('table_passcode_updated', { tableNumber, passcode: newPasscode });
    io.to(restaurantId).emit('session_closed', { tableNumber, sessionId: latestOrder.sessionId });

    res.json({ message: 'Session closed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/waiter/calls — pending waiter calls
router.get('/calls', authWaiter, async (req, res) => {
  try {
    const calls = await prisma.waiterCall.findMany({
      where: { restaurantId: req.user.restaurantId, status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/waiter/calls/:id/attend — mark call as attended
router.put('/calls/:id/attend', authWaiter, async (req, res) => {
  try {
    const call = await prisma.waiterCall.update({
      where: { id: req.params.id },
      data: { status: 'attended' }
    });
    res.json(call);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/waiter/live-orders — active orders for restaurant
router.get('/live-orders', authWaiter, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.user.restaurantId,
        status: { not: 'completed' }
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

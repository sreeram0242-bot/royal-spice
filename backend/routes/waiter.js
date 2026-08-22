const express = require('express');
const router = express.Router();
const { authWaiter } = require('../middleware/auth');
const prisma = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const QRCode = require('qrcode');

// GET /api/waiter/settings — restaurant info for waiter
router.get('/settings', authWaiter, async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: { 
        name: true, 
        logo: true, 
        address: true, 
        gstPercent: true, 
        totalTables: true, 
        paymentQrCode: true,
        orderConfirmationMode: true,
        enforceWaiterPaymentGateway: true,
        razorpayKeyId: true,
        enableTestPayment: true
      }
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

    // Get active passcodes for THIS waiter
    const passcodes = await prisma.tablePasscode.findMany({
      where: { restaurantId: req.user.restaurantId, waiterId: req.user.waiterId }
    });

    const tableMappings = await prisma.table.findMany({
      where: { restaurantId: req.user.restaurantId },
      include: { category: true }
    });

    const tables = [];
    const waiterName = req.user.waiterName || 'Waiter';
    for (let i = 1; i <= restaurant.totalTables; i++) {
      const tableOrders = activeOrders.filter(o => o.tableNumber === i);
      const hasCall = calls.some(c => c.tableNumber === i);
      const total = tableOrders.reduce((sum, o) => sum + o.total, 0);
      const statuses = tableOrders.map(o => o.status);
      let status = 'available';
      const isOccupied = tableOrders.length > 0;
      if (isOccupied) {
        if (statuses.includes('new')) status = 'new';
        else if (statuses.includes('preparing')) status = 'preparing';
        else if (statuses.includes('ready')) status = 'ready';
        else status = 'occupied';
      }

      let passcode = passcodes.find(p => p.tableNumber === i)?.passcode || null;
      
      if (!isOccupied && !passcode) {
        passcode = Math.floor(1000 + Math.random() * 9000).toString();
        await prisma.tablePasscode.create({
          data: {
            restaurantId: req.user.restaurantId,
            tableNumber: i,
            waiterId: req.user.waiterId,
            passcode,
            waiterName
          }
        });
      }

      const tMap = tableMappings.find(t => t.tableNumber === i);

      tables.push({
        tableNumber: i,
        name: tMap ? tMap.name : `Table ${i}`,
        categoryName: tMap && tMap.category ? tMap.category.name : 'Main',
        categoryId: tMap ? tMap.categoryId : null,
        status,
        hasCall,
        orderCount: tableOrders.length,
        total,
        sessionId: tableOrders.length > 0 ? tableOrders[0].sessionId : null,
        passcode: isOccupied ? null : passcode
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
    const [restaurant, latestOrder] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: req.user.restaurantId },
        select: { name: true, address: true, gstPercent: true }
      }),
      prisma.order.findFirst({
        where: { restaurantId: req.user.restaurantId, tableNumber, status: { not: 'completed' } },
        orderBy: { createdAt: 'desc' }
      })
    ]);

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
        waiterName: req.user.waiterName || req.user.name || 'Waiter',
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

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { enforceWaiterPaymentGateway: true }
    });

    if (restaurant && restaurant.enforceWaiterPaymentGateway) {
      const lowerMethod = (paymentMethod || '').toLowerCase();
      if (lowerMethod.includes('cash') || lowerMethod.includes('split')) {
        return res.status(403).json({ message: 'Waiters are required to settle tables via Payment Gateway / QR Code scan.' });
      }
    }

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
        paymentMethod: paymentMethod || 'cash'
      }
    });

    await prisma.tablePasscode.deleteMany({
      where: { restaurantId, tableNumber }
    });

    const io = req.app.get('io');
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

// POST /api/waiter/table/:num/create-razorpay-order — Create official Razorpay Order & Dynamic UPI QR
router.post('/table/:num/create-razorpay-order', authWaiter, async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.num);
    const restaurantId = req.user.restaurantId;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, razorpayKeyId: true, razorpayKeySecret: true, enableTestPayment: true, gstPercent: true, paymentQrCode: true }
    });

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const orders = await prisma.order.findMany({
      where: { restaurantId, tableNumber, status: { not: 'completed' } },
      include: { items: true }
    });

    if (orders.length === 0) {
      return res.status(400).json({ message: 'No active orders found for this table' });
    }

    let subtotal = 0;
    let totalTip = 0;
    orders.forEach(o => {
      totalTip += (o.tip || 0);
      subtotal += (o.subtotal || 0);
    });

    const gstPercent = restaurant.gstPercent || 0;
    const gstAmount = Math.round(subtotal * (gstPercent / 100));
    const grandTotal = Math.round(subtotal + gstAmount + totalTip);
    const amountInPaise = grandTotal * 100;

    let razorpayOrderId = null;

    if (restaurant.razorpayKeyId && restaurant.razorpayKeySecret) {
      const razorpay = new Razorpay({
        key_id: restaurant.razorpayKeyId,
        key_secret: restaurant.razorpayKeySecret
      });

      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `tbl_${tableNumber}_${Date.now()}`
      });
      razorpayOrderId = rzpOrder.id;
    }

    // Dynamic UPI QR Code
    const upiId = restaurant.razorpayKeyId ? `${restaurant.razorpayKeyId}@razorpay` : 'merchant@upi';
    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(restaurant.name)}&am=${grandTotal}&tr=TBL${tableNumber}_${Date.now()}&tn=Table_${tableNumber}_Bill`;
    const generatedQr = await QRCode.toDataURL(upiString);

    res.json({
      success: true,
      grandTotal,
      amountInPaise,
      currency: 'INR',
      razorpayOrderId,
      keyId: restaurant.razorpayKeyId,
      enableTestPayment: restaurant.enableTestPayment,
      upiQrCodeUrl: restaurant.paymentQrCode || generatedQr,
      restaurantName: restaurant.name
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    res.status(500).json({ message: err.message || 'Failed to create payment order' });
  }
});

// POST /api/waiter/table/:num/verify-razorpay-payment — Cryptographically verify payment & auto-close session
router.post('/table/:num/verify-razorpay-payment', authWaiter, async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.num);
    const restaurantId = req.user.restaurantId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { razorpayKeySecret: true }
    });

    if (restaurant && restaurant.razorpayKeySecret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', restaurant.razorpayKeySecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: 'Invalid payment signature! Verification failed.' });
      }
    }

    const latestOrder = await prisma.order.findFirst({
      where: { restaurantId, tableNumber, status: { not: 'completed' } },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestOrder) {
      return res.status(404).json({ message: 'No active session for this table' });
    }

    const payMethod = razorpay_payment_id ? `Razorpay Verified (${razorpay_payment_id})` : 'Online Payment Gateway';

    await prisma.order.updateMany({
      where: { sessionId: latestOrder.sessionId },
      data: {
        status: 'completed',
        paymentMethod: payMethod
      }
    });

    await prisma.tablePasscode.deleteMany({
      where: { restaurantId, tableNumber }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(restaurantId).emit('session_closed', { tableNumber, sessionId: latestOrder.sessionId });
    }

    res.json({ success: true, message: '✅ Payment Verified & Session Closed Successfully!' });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ message: 'Server error during payment verification' });
  }
});

module.exports = router;

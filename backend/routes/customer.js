const express = require('express');
const router = express.Router();
const { checkSubscription } = require('../middleware/auth');
const prisma = require('../db');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Get restaurant details for customer portal
router.get('/restaurant/:id', async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      select: { 
        id: true,
        name: true, 
        logo: true, 
        gstPercent: true, 
        isActive: true,
        paymentQrCode: true,
        orderConfirmationMode: true,
        paymentGatewayProvider: true,
        razorpayKeyId: true,
        enableTestPayment: true
      }
    });
    
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    if (!restaurant.isActive) return res.status(403).json({ message: 'Restaurant is currently unavailable' });
    
    let tableName = null;
    if (req.query.tableNumber) {
      const table = await prisma.table.findUnique({
        where: {
          restaurantId_tableNumber: {
            restaurantId: req.params.id,
            tableNumber: parseInt(req.query.tableNumber)
          }
        }
      });
      if (table) tableName = table.name;
    }
    
    res.json({ ...restaurant, tableName });
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
router.post('/order', checkSubscription, async (req, res) => {
  try {
    const { restaurantId, tableNumber, items, subtotal, gst, tip = 0, total, sessionId, passcode, paymentMethod, paymentReference } = req.body;
    
    // Fetch Restaurant Config
    const restaurantConfig = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { orderConfirmationMode: true, enableTestPayment: true }
    });

    if (!restaurantConfig) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const mode = restaurantConfig.orderConfirmationMode || 'WAITER_PASSCODE';
    let assignedWaiterName = 'Self-Order';

    // Mode-specific validation
    if (mode === 'WAITER_PASSCODE') {
      const validPasscode = await prisma.tablePasscode.findFirst({
        where: { restaurantId, tableNumber: parseInt(tableNumber), passcode }
      });
      
      if (!validPasscode) {
        return res.status(401).json({ message: 'Invalid or missing 4-digit passcode. Please ask the waiter.' });
      }
      assignedWaiterName = validPasscode.waiterName || 'Waiter';
    } else if (mode === 'PAYMENT_GATEWAY') {
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
      assignedWaiterName = `Online Payment (${razorpay_payment_id || 'Paid'})`;
    } else if (mode === 'UPI_QR') {
      assignedWaiterName = `UPI QR (${paymentReference ? 'Ref: ' + paymentReference : 'Submitted'})`;
    } else if (mode === 'DIRECT_ORDER') {
      assignedWaiterName = 'Direct Order';
    }

    // Generate order number
    const count = await prisma.order.count({ where: { restaurantId } });
    const orderNumber = 1000 + count + 1;

    // Enforce single-session per table: check active order first
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
        tableNumber,
        orderNumber,
        subtotal,
        gst,
        tip,
        total,
        status: 'new',
        sessionId: currentSessionId,
        sessionNumber: currentSessionNumber,
        waiterName: assignedWaiterName,
        paymentMethod: paymentMethod || (mode === 'PAYMENT_GATEWAY' ? 'online' : mode === 'UPI_QR' ? 'upi' : null),
        items: {
          create: items.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            qty: item.qty,
            specialNote: item.specialNote || null
          }))
        }
      },
      include: { items: true }
    });

    // Emit via Socket.IO to admin
    const io = req.app.get('io');
    if (io) {
      io.to(restaurantId).emit('new_order', order);
    }

    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    console.error('Order Placement Error:', err);
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

    const io = req.app.get('io');
    if (io) {
      io.to(restaurantId).emit('waiter_call', call);
    }

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

// POST /api/customer/create-razorpay-order
router.post('/create-razorpay-order', async (req, res) => {
  try {
    const { restaurantId, grandTotal } = req.body;
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, razorpayKeyId: true, razorpayKeySecret: true, enableTestPayment: true }
    });

    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    let razorpayOrderId = null;
    let amountInPaise = Math.round(grandTotal * 100);

    if (restaurant.razorpayKeyId && restaurant.razorpayKeySecret) {
      const razorpay = new Razorpay({
        key_id: restaurant.razorpayKeyId,
        key_secret: restaurant.razorpayKeySecret
      });

      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `cust_${Date.now()}`
      });
      razorpayOrderId = rzpOrder.id;
    }

    res.json({
      success: true,
      razorpayOrderId,
      amountInPaise,
      currency: 'INR',
      keyId: restaurant.razorpayKeyId,
      restaurantName: restaurant.name
    });
  } catch (err) {
    console.error('Customer Razorpay order creation error:', err);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
});

module.exports = router;

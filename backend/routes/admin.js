const express = require('express');
const router = express.Router();
const { authAdmin } = require('../middleware/auth');
const prisma = require('../db');

// --- Dashboard & Restaurant Settings ---
router.get('/settings', authAdmin, async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: {
        id: true, name: true, logo: true, address: true, gstPercent: true,
        totalTables: true, plan: true, trialDays: true, trialStartDate: true,
        subscriptionExpiry: true, paymentStatus: true, isActive: true, createdAt: true
      }
    });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/settings', authAdmin, async (req, res) => {
  try {
    const { name, address, gstPercent, totalTables } = req.body;
    
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (address !== undefined) dataToUpdate.address = address;
    if (gstPercent !== undefined) dataToUpdate.gstPercent = parseFloat(gstPercent);
    if (totalTables !== undefined) dataToUpdate.totalTables = parseInt(totalTables);

    const restaurant = await prisma.restaurant.update({
      where: { id: req.user.restaurantId },
      data: dataToUpdate,
      select: {
        id: true, name: true, logo: true, address: true, gstPercent: true,
        totalTables: true, plan: true, trialDays: true, trialStartDate: true,
        subscriptionExpiry: true, paymentStatus: true, isActive: true, createdAt: true
      }
    });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Menu Management ---
router.get('/menu', authAdmin, async (req, res) => {
  try {
    const menu = await prisma.menuItem.findMany({
      where: { restaurantId: req.user.restaurantId }
    });
    res.json(menu);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/menu', authAdmin, async (req, res) => {
  try {
    const { name, description, price, image, category, isVeg, isBestSeller, isAvailable } = req.body;
    const newItem = await prisma.menuItem.create({
      data: {
        restaurantId: req.user.restaurantId,
        name,
        description,
        price: parseFloat(price),
        image,
        category,
        isVeg: isVeg === undefined ? undefined : Boolean(isVeg),
        isBestSeller: isBestSeller === undefined ? undefined : Boolean(isBestSeller),
        isAvailable: isAvailable === undefined ? undefined : Boolean(isAvailable)
      }
    });
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/menu/:id', authAdmin, async (req, res) => {
  try {
    const { name, description, price, image, category, isVeg, isBestSeller, isAvailable } = req.body;
    const updatedItem = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        price: price !== undefined ? parseFloat(price) : undefined,
        image,
        category,
        isVeg: isVeg !== undefined ? Boolean(isVeg) : undefined,
        isBestSeller: isBestSeller !== undefined ? Boolean(isBestSeller) : undefined,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined
      }
    });
    res.json(updatedItem);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/menu/:id', authAdmin, async (req, res) => {
  try {
    await prisma.menuItem.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Orders Management ---
router.get('/orders', authAdmin, async (req, res) => {
  try {
    const where = { restaurantId: req.user.restaurantId };
    
    // Optional filters e.g. ?date=today
    if (req.query.date === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/orders/:id/status', authAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status }
    });
    
    // Notify customer
    const io = req.app.get('io');
    io.to(req.user.restaurantId).emit('order_status_update', { orderId: order.id, status: order.status, tableNumber: order.tableNumber });
    
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Waiter Calls ---
router.get('/waiter-calls', authAdmin, async (req, res) => {
  try {
    const calls = await prisma.waiterCall.findMany({
      where: { restaurantId: req.user.restaurantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/waiter-calls/:id', authAdmin, async (req, res) => {
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

// --- Notifications ---
router.get('/notifications', authAdmin, async (req, res) => {
  try {
    const notifs = await prisma.masterNotification.findMany({
      where: { restaurantId: req.user.restaurantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/notifications/:id/read', authAdmin, async (req, res) => {
  try {
    await prisma.masterNotification.update({
      where: { id: req.params.id },
      data: { isRead: true }
    });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Revenue ---
router.get('/revenue', authAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.user.restaurantId,
        status: 'served'
      }
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let totalRevenue = 0;
    let todayRevenue = 0;
    let totalOrders = orders.length;

    // Last 7 days
    const revenueByDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      revenueByDay.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateString: d.toISOString().split('T')[0],
        revenue: 0
      });
    }

    orders.forEach(o => {
      totalRevenue += o.total;
      
      const orderDate = new Date(o.createdAt);
      if (orderDate >= todayStart) {
        todayRevenue += o.total;
      }
      
      const orderDateString = orderDate.toISOString().split('T')[0];
      const dayData = revenueByDay.find(d => d.dateString === orderDateString);
      if (dayData) {
        dayData.revenue += o.total;
      }
    });

    res.json({
      totalRevenue,
      todayRevenue,
      totalOrders,
      revenueByDay
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// --- Order History ---
router.get('/history', authAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      // Parse ISO dates or YYYY-MM-DD
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include entire end day
      
      dateFilter = {
        createdAt: {
          gte: start,
          lte: end
        }
      };
    }

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.user.restaurantId,
        status: 'served',
        ...dateFilter
      },
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Complaints ---
router.get('/complaints', authAdmin, async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { restaurantId: req.user.restaurantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/complaints', authAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const complaint = await prisma.complaint.create({
      data: {
        restaurantId: req.user.restaurantId,
        message
      }
    });
    res.status(201).json(complaint);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Categories Management ---
router.get('/categories', authAdmin, async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: req.user.restaurantId },
      select: { category: true }
    });
    
    const settings = await prisma.categorySetting.findMany({
      where: { restaurantId: req.user.restaurantId }
    });
    
    const categories = [...new Set(menuItems.map(item => item.category))];
    if (!categories.includes('All')) categories.unshift('All');
    
    const result = categories.map(cat => {
      const setting = settings.find(s => s.categoryName === cat);
      return {
        name: cat,
        image: setting?.image || ''
      };
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/categories', authAdmin, async (req, res) => {
  try {
    const { categoryName, image } = req.body;
    
    const setting = await prisma.categorySetting.upsert({
      where: {
        restaurantId_categoryName: {
          restaurantId: req.user.restaurantId,
          categoryName
        }
      },
      update: { image },
      create: {
        restaurantId: req.user.restaurantId,
        categoryName,
        image
      }
    });
    
    res.json({ message: 'Category image updated', setting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// CATEGORY SETTINGS
router.get('/categories', authAdmin, async (req, res) => {
  try {
    const settings = await prisma.categorySetting.findMany({
      where: { restaurantId: req.user.restaurantId }
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/categories', authAdmin, async (req, res) => {
  try {
    const { categoryName, image } = req.body;
    const existing = await prisma.categorySetting.findFirst({
      where: { restaurantId: req.user.restaurantId, categoryName }
    });
    
    let result;
    if (existing) {
      result = await prisma.categorySetting.update({
        where: { id: existing.id },
        data: { image }
      });
    } else {
      result = await prisma.categorySetting.create({
        data: {
          restaurantId: req.user.restaurantId,
          categoryName,
          image
        }
      });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// --- Waiter Management ---
const bcrypt = require('bcryptjs');

router.get('/waiters', authAdmin, async (req, res) => {
  try {
    const waiters = await prisma.waiter.findMany({
      where: { restaurantId: req.user.restaurantId },
      select: { id: true, name: true, username: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(waiters);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/waiters', authAdmin, async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ message: 'Name, username and password are required' });
    }

    // Check username uniqueness within restaurant
    const existing = await prisma.waiter.findUnique({
      where: { restaurantId_username: { restaurantId: req.user.restaurantId, username } }
    });
    if (existing) return res.status(409).json({ message: 'Username already exists for this restaurant' });

    const passwordHash = await bcrypt.hash(password, 10);
    const waiter = await prisma.waiter.create({
      data: {
        restaurantId: req.user.restaurantId,
        name,
        username,
        passwordHash
      },
      select: { id: true, name: true, username: true, isActive: true, createdAt: true }
    });
    res.status(201).json(waiter);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/waiters/:id', authAdmin, async (req, res) => {
  try {
    await prisma.waiter.delete({ where: { id: req.params.id } });
    res.json({ message: 'Waiter deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Table Bill (for admin print) ---
router.get('/table/:num/bill', authAdmin, async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.num);
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: { name: true, address: true, gstPercent: true }
    });

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
    const gstAmount = orders.reduce((sum, o) => sum + o.gst, 0);
    const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);

    res.json({ restaurant, tableNumber, sessionId: latestOrder.sessionId, orders, subtotal, gstAmount, gstPercent: restaurant.gstPercent, grandTotal, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

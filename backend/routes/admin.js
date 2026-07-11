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
        subscriptionExpiry: true, paymentStatus: true, paymentQrCode: true, isActive: true, createdAt: true
      }
    });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/settings', authAdmin, async (req, res) => {
  try {
    const { name, address, gstPercent, totalTables, paymentQrCode } = req.body;
    
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (address !== undefined) dataToUpdate.address = address;
    if (gstPercent !== undefined) dataToUpdate.gstPercent = parseFloat(gstPercent);
    if (totalTables !== undefined) dataToUpdate.totalTables = parseInt(totalTables);
    if (paymentQrCode !== undefined) dataToUpdate.paymentQrCode = paymentQrCode;

    const restaurant = await prisma.restaurant.update({
      where: { id: req.user.restaurantId },
      data: dataToUpdate,
      select: {
        id: true, name: true, logo: true, address: true, gstPercent: true,
        totalTables: true, plan: true, trialDays: true, trialStartDate: true,
        subscriptionExpiry: true, paymentStatus: true, paymentQrCode: true, isActive: true, createdAt: true
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

// GET /api/admin/tables
router.get('/tables', authAdmin, async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    
    const activeOrders = await prisma.order.findMany({
      where: { restaurantId, status: { not: 'completed' } }
    });
    const tables = [];
    for (let i = 1; i <= restaurant.totalTables; i++) {
      const tableOrders = activeOrders.filter(o => o.tableNumber === i);
      const isOccupied = tableOrders.length > 0;
      
      const subtotal = tableOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
      const gstAmount = subtotal * ((restaurant.gstPercent || 0) / 100);
      const tip = tableOrders.reduce((sum, o) => sum + (o.tip || 0), 0);
      const total = Math.round(subtotal + gstAmount + tip);

      tables.push({
        tableNumber: i,
        status: isOccupied ? 'occupied' : 'available',
        total,
        waiterName: isOccupied ? tableOrders[0].waiterName : null
      });
    }

    res.json(tables);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/table/:num/bill — full bill for a table
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

// POST /api/admin/table/:num/close-session — close a table session
router.post('/table/:num/close-session', authAdmin, async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.num);
    const restaurantId = req.user.restaurantId;
    const { paymentMethod } = req.body;

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

// --- Revenue ---
router.get('/revenue', authAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.user.restaurantId,
        status: { in: ['served', 'completed'] }
      }
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalRevenue = 0;
    let todayRevenue = 0;
    let weekRevenue = 0;
    let monthRevenue = 0;
    let totalOrders = orders.length;
    let cashTotal = 0, upiTotal = 0, cardTotal = 0;

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
      if (orderDate >= todayStart) todayRevenue += o.total;
      if (orderDate >= weekStart) weekRevenue += o.total;
      if (orderDate >= monthStart) monthRevenue += o.total;

      // Payment breakdown
      const pm = (o.paymentMethod || 'cash').toLowerCase();
      if (pm.includes('cash')) cashTotal += o.total;
      else if (pm.includes('upi')) upiTotal += o.total;
      else if (pm.includes('card')) cardTotal += o.total;
      else cashTotal += o.total; // default

      const orderDateString = orderDate.toISOString().split('T')[0];
      const dayData = revenueByDay.find(d => d.dateString === orderDateString);
      if (dayData) dayData.revenue += o.total;
    });

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    res.json({
      totalRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      totalOrders,
      avgOrderValue,
      paymentBreakdown: { cash: cashTotal, upi: upiTotal, card: cardTotal },
      revenueByDay
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Analytics ---
router.get('/analytics', authAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.user.restaurantId,
        status: { in: ['served', 'completed'] }
      },
      include: { items: true }
    });

    // Top selling items
    const itemMap = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemMap[item.name].qty += item.qty;
        itemMap[item.name].revenue += item.price * item.qty;
      });
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Revenue by table
    const tableMap = {};
    orders.forEach(o => {
      const tn = `Table ${o.tableNumber}`;
      if (!tableMap[tn]) tableMap[tn] = { table: tn, revenue: 0, orders: 0 };
      tableMap[tn].revenue += o.total;
      tableMap[tn].orders++;
    });
    const tableRevenue = Object.values(tableMap).sort((a, b) => b.revenue - a.revenue);

    // Hourly breakdown (orders by hour of day)
    const hourMap = Array(24).fill(0);
    orders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      hourMap[hour]++;
    });

    res.json({ topItems, tableRevenue, hourlyOrders: hourMap });
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
        status: { in: ['served', 'completed'] },
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

    // Check username uniqueness globally
    const existing = await prisma.waiter.findUnique({
      where: { username }
    });
    if (existing) return res.status(409).json({ message: 'Username already exists globally. Please choose another username.' });

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
    const gstAmount = subtotal * (restaurant.gstPercent / 100);
    const totalTip = orders.reduce((sum, o) => sum + (o.tip || 0), 0);
    const grandTotal = Math.round(subtotal + gstAmount + totalTip);

    res.json({ restaurant, tableNumber, sessionId: latestOrder.sessionId, orders, subtotal, gstAmount, gstPercent: restaurant.gstPercent, totalTip, grandTotal, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

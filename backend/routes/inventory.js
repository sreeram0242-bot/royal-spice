const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authAdmin, checkSubscription } = require('../middleware/auth');

router.use(authAdmin);
router.use(checkSubscription);

// ----- INVENTORY ITEMS ----- //

// Get all inventory items
router.get('/', async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { restaurantId: req.user.restaurantId },
      orderBy: { name: 'asc' }
    });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new inventory item
router.post('/', async (req, res) => {
  try {
    const { name, quantity, unit, minimumStockLevel, expiryDate, pricePerUnit, createdAt } = req.body;
    const item = await prisma.inventoryItem.create({
      data: {
        restaurantId: req.user.restaurantId,
        name,
        quantity: parseFloat(quantity) || 0,
        unit,
        minimumStockLevel: parseFloat(minimumStockLevel) || 0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        pricePerUnit: parseFloat(pricePerUnit) || 0,
        createdAt: createdAt ? new Date(createdAt) : undefined
      }
    });
    res.json(item);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(400).json({ message: 'Item already exists' });
    res.status(500).json({ message: 'Server error' });
  }
});

// Update inventory item
router.put('/:id', async (req, res) => {
  try {
    const { name, quantity, unit, minimumStockLevel, expiryDate, pricePerUnit, createdAt } = req.body;
    
    // Check if it belongs to this restaurant
    const existing = await prisma.inventoryItem.findFirst({
        where: { id: req.params.id, restaurantId: req.user.restaurantId }
    });
    if (!existing) return res.status(404).json({ message: 'Item not found' });

    const item = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        name,
        quantity: parseFloat(quantity) || 0,
        unit,
        minimumStockLevel: parseFloat(minimumStockLevel) || 0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        pricePerUnit: parseFloat(pricePerUnit) || 0,
        createdAt: createdAt ? new Date(createdAt) : undefined
      }
    });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete inventory item
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.inventoryItem.findFirst({
        where: { id: req.params.id, restaurantId: req.user.restaurantId }
    });
    if (!existing) return res.status(404).json({ message: 'Item not found' });

    await prisma.inventoryItem.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ----- VENDORS ----- //

router.get('/vendors', async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { restaurantId: req.user.restaurantId },
      orderBy: { name: 'asc' }
    });
    res.json(vendors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/vendors', async (req, res) => {
  try {
    const { name, contactName, phone, email, address } = req.body;
    const vendor = await prisma.vendor.create({
      data: {
        restaurantId: req.user.restaurantId,
        name,
        contactName,
        phone,
        email,
        address
      }
    });
    res.json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/vendors/:id', async (req, res) => {
  try {
    await prisma.vendor.deleteMany({
      where: { id: req.params.id, restaurantId: req.user.restaurantId }
    });
    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ----- WASTAGE ----- //

router.get('/wastage', async (req, res) => {
  try {
    const logs = await prisma.wastageLog.findMany({
      where: { restaurantId: req.user.restaurantId },
      include: { inventoryItem: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/wastage', async (req, res) => {
  try {
    const { inventoryItemId, quantity, reason } = req.body;
    const qty = parseFloat(quantity) || 0;
    
    // Create log
    const log = await prisma.wastageLog.create({
      data: {
        restaurantId: req.user.restaurantId,
        inventoryItemId,
        quantity: qty,
        reason
      }
    });

    // Deduct stock
    await prisma.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { quantity: { decrement: qty } }
    });

    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Stock History (Purchase Log)
router.get('/stock', async (req, res) => {
  try {
    const history = await prisma.stockTransaction.findMany({
      where: { restaurantId: req.user.restaurantId },
      include: {
        inventoryItem: true,
        vendor: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error('Fetch Stock History error:', error);
    res.status(500).json({ message: 'Error fetching stock history' });
  }
});

// Add Stock (Creates StockTransaction AND updates InventoryItem quantity)
router.post('/stock', async (req, res) => {
  try {
    const { inventoryItemId, quantityAdded, vendorId, cost, notes, date } = req.body;
    const qty = parseFloat(quantityAdded) || 0;
    if (qty <= 0) return res.status(400).json({ message: 'Quantity added must be greater than 0' });

    // Verify item belongs to this restaurant
    const item = await prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, restaurantId: req.user.restaurantId }
    });
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });

    // 1. Log the transaction with custom date if provided
    const transaction = await prisma.stockTransaction.create({
      data: {
        restaurantId: req.user.restaurantId,
        inventoryItemId,
        quantityAdded: qty,
        vendorId: vendorId || null,
        cost: cost ? parseFloat(cost) : null,
        notes: notes || null,
        createdAt: date ? new Date(date) : undefined
      }
    });

    // 2. Increment the total quantity of the InventoryItem
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        quantity: { increment: qty }
      }
    });

    res.json(transaction);
  } catch (error) {
    console.error('Add Stock error:', error);
    res.status(500).json({ message: 'Error adding stock' });
  }
});

// Get Stock Usage Log
router.get('/usage', async (req, res) => {
  try {
    const usageList = await prisma.stockUsage.findMany({
      where: { restaurantId: req.user.restaurantId },
      include: {
        inventoryItem: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(usageList);
  } catch (error) {
    console.error('Fetch Stock Usage error:', error);
    res.status(500).json({ message: 'Error fetching stock usage' });
  }
});

// Log Stock Usage (Creates StockUsage AND decrements InventoryItem quantity)
router.post('/usage', async (req, res) => {
  try {
    const { inventoryItemId, quantityUsed, cost, notes, date } = req.body;
    
    const qty = parseFloat(quantityUsed) || 0;
    if (qty <= 0) return res.status(400).json({ message: 'Quantity used must be greater than 0' });

    // Verify item belongs to this restaurant
    const item = await prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, restaurantId: req.user.restaurantId }
    });
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });

    // 1. Create Usage Record
    const usage = await prisma.stockUsage.create({
      data: {
        restaurantId: req.user.restaurantId,
        inventoryItemId,
        quantityUsed: qty,
        cost: cost ? parseFloat(cost) : null,
        notes: notes || null,
        createdAt: date ? new Date(date) : undefined
      }
    });

    // 2. Deduct live quantity from InventoryItem
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        quantity: { decrement: qty }
      }
    });

    res.json(usage);
  } catch (error) {
    console.error('Log Usage error:', error);
    res.status(500).json({ message: 'Error logging stock usage' });
  }
});

module.exports = router;

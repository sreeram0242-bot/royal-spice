const jwt = require('jsonwebtoken');
const prisma = require('../db');

const authMaster = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (verified.role !== 'master') {
      return res.status(403).json({ message: 'Access Denied: Master privileges required' });
    }
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid Token' });
  }
};

const authAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (verified.role !== 'admin') {
      return res.status(403).json({ message: 'Access Denied: Admin privileges required' });
    }
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid Token' });
  }
};

const authWaiter = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (verified.role !== 'waiter') {
      return res.status(403).json({ message: 'Access Denied: Waiter privileges required' });
    }
    if (!verified.waiterId) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid Token' });
  }
};

const checkSubscription = async (req, res, next) => {
  try {
    const restaurantId = req.user?.restaurantId || req.query.restaurantId || req.body.restaurantId;
    if (!restaurantId) return res.status(400).json({ message: 'Restaurant ID required' });

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant || !restaurant.isActive) {
      return res.status(402).json({ message: 'Restaurant account is suspended or not found.' });
    }

    const now = new Date();
    if (restaurant.plan === 'trial') {
      if (restaurant.subscriptionExpiry && new Date(restaurant.subscriptionExpiry) < now) {
         return res.status(402).json({ message: 'Trial has expired. Please upgrade your plan.' });
      }
    } else if (restaurant.paymentStatus !== 'active') {
      if (restaurant.subscriptionExpiry && new Date(restaurant.subscriptionExpiry) < now) {
        return res.status(402).json({ message: 'Subscription has expired. Please renew.' });
      }
    }

    next();
  } catch (err) {
    console.error('Subscription Check Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { authMaster, authAdmin, authWaiter, checkSubscription };

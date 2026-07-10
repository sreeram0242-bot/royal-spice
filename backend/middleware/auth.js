const jwt = require('jsonwebtoken');

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

module.exports = { authMaster, authAdmin, authWaiter };

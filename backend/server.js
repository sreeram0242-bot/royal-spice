const express = require('express');
const http = require('http');
const cors = require('cors');

const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development
    methods: ['GET', 'POST']
  }
});

// Middleware
require('express-async-errors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Use Helmet for security headers, but disable CSP to avoid breaking frontend scripts/styles
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// Global API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Limit each IP to 120 requests per `window` (here, per minute)
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});
app.use('/api/', apiLimiter);

// Removed aggressive caching headers for faster loading

const staticOptions = {
  setHeaders: (res, path, stat) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
};

// Serve Static Portals
app.use('/customer', express.static(path.join(__dirname, '../customer'), staticOptions));
app.use('/admin', express.static(path.join(__dirname, '../admin'), staticOptions));
app.use('/master', express.static(path.join(__dirname, '../master'), staticOptions));
app.use('/waiter', express.static(path.join(__dirname, '../waiter'), staticOptions));
app.use('/logo', express.static(path.join(__dirname, '../logo asset'), staticOptions));

// Redirect root to customer menu (can be changed later)
app.get('/', (req, res) => res.redirect('/customer'));

const prisma = require('./db');

// Test DB connection on startup
async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ CockroachDB connected via Prisma');
  } catch (err) {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  }
}
connectDB();

// Socket.IO Logic
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // When a user (customer/admin) joins a restaurant's room
  socket.on('join_restaurant', (restaurantId) => {
    socket.join(restaurantId);
    console.log(`Socket ${socket.id} joined restaurant ${restaurantId}`);
  });

  socket.on('new_order', (data) => {
    // Notify admin
    io.to(data.restaurantId).emit('new_order', data);
  });

  socket.on('waiter_call', (data) => {
    // Notify admin
    io.to(data.restaurantId).emit('waiter_call', data);
  });

  socket.on('order_status_update', (data) => {
    // Notify customer
    io.to(data.restaurantId).emit('order_status_update', data);
  });

  socket.on('master_notification', (data) => {
    // Notify admin
    io.to(data.restaurantId).emit('master_notification', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Setup socket reference for routes to use
app.set('io', io);

// Initialize Cron Jobs
require('./cron')(io);

// Health Check Route (For cron-job.org / UptimeRobot to ping)
app.get('/', (req, res) => {
  res.status(200).send('Royal Spice Server is Awake and Running!');
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/master', require('./routes/master'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/waiter', require('./routes/waiter'));

// Global Error Handler (must be after all routes)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ message: 'Internal Server Error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

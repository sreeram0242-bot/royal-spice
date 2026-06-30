const express = require('express');
const http = require('http');
const cors = require('cors');

const { Server } = require('socket.io');
require('dotenv').config({ path: '../.env' });
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

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

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/master', require('./routes/master'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/waiter', require('./routes/waiter'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

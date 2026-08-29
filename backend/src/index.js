require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initializeDatabase, pool } = require('./config/database');
const routes = require('./routes');
const { initCronJobs } = require('./services/cronService');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti' },
});
app.use('/api/', limiter);

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Socket.IO for realtime notifications
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Broadcast new notifications every 10 seconds
setInterval(async () => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE is_read = 0 AND severity IN (\'critical\',\'danger\') ORDER BY created_at DESC LIMIT 5'
    );
    if (rows.length > 0) {
      io.emit('notifications', rows);
    }
  } catch (e) {}
}, 10000);

// Make io accessible in routes
app.set('io', io);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await initializeDatabase();
    await initCronJobs();
    server.listen(PORT, () => {
      console.log(`🚀 Server berjalan di port ${PORT}`);
      console.log(`📡 Socket.IO aktif`);
    });
  } catch (err) {
    console.error('❌ Gagal start server:', err);
    process.exit(1);
  }
}

start();

require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes - Real Full-Stack MySQL Endpoints
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/buses', require('./routes/busRoutes'));
app.use('/api/routes', require('./routes/routeRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/receipts', require('./routes/receiptRoutes'));
app.use('/api/passes', require('./routes/passRoutes'));
app.use('/api/bus-passes', require('./routes/passRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/cancellations', require('./routes/cancellationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/maps', require('./routes/mapsRoutes'));

// Health check endpoint with real MySQL ping
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'online',
      database: 'connected',
      system: 'College Transportation Management System',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'degraded',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Fallback route to serve index.html for unknown frontend routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    error: err.message
  });
});

function startServer(port, retries = 5) {
  const server = app.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`  🚌 College Transportation Management System is LIVE! `);
    console.log(`  Database: MySQL (college_transportation)              `);
    console.log(`  Access URL: http://localhost:${port}                 `);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  Port ${port} is already in use by another running process.`);
      if (retries > 0) {
        const nextPort = Number(port) + 1;
        console.log(`🔄 Automatically attempting backup port: ${nextPort}...\n`);
        startServer(nextPort, retries - 1);
      } else {
        console.error(`\n❌ Could not bind to an open port after several attempts.`);
        console.error(`👉 Run in PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force\n`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);

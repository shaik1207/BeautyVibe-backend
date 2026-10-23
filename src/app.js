const express = require('express');
const cors = require('cors');

// Import core routes
const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const tableRoutes = require('./routes/tableRoutes');

// Import placeholder/dashboard routes to prevent 404 errors
const customerRoutes = require('./routes/customerRoutes');
const packageRoutes = require('./routes/packageRoutes');
const staffRoutes = require('./routes/staffRoutes');
const offerRoutes = require('./routes/offerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// BULLETPROOF CORS CONFIGURATION: Explicitly whitelist Idempotency-Key
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Idempotency-Key', 
    'idempotency-key'
  ]
}));

// Body parsing with increased limits for uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount Core Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/tables', tableRoutes);

// Mount Dashboard Data Routes
app.use('/api/customers', customerRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

// Root Health Check
app.get('/', (req, res) => res.status(200).json({ success: true, message: "BeautyVibe API Running." }));

// 404 Handler (Must be after all other routes)
app.use((req, res) => res.status(404).json({ success: false, message: "Endpoint not found." }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack); 
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    success: false, 
    message: err.message || "Internal server error." 
  });
});

module.exports = app;
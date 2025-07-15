const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight OPTIONS requests for all routes
app.options('*', cors());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes that need JSON parsing (no file uploads)
app.use('/api/auth', express.json({ limit: '10mb' }), require('./routes/auth.routes'));
app.use('/api/partners', express.json({ limit: '10mb' }), require('./routes/partner.routes'));
app.use('/api/customers', express.json({ limit: '10mb' }), require('./routes/customer.routes'));
app.use('/api/units', express.json({ limit: '10mb' }), require('./routes/unit.routes'));

// Reports route - NO express.json() to allow multer to handle multipart requests
app.use('/api/reports', require('./routes/report.routes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
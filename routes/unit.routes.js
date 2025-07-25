const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  getAllUnits,
  getCustomerUnits,
  getPartnerUnits,
  createUnit,
  createPartnerUnit,
  updateUnit,
  deleteUnit,
  getUnitById
} = require('../controllers/unit.controller');

// Base protection - all routes require authentication
router.use(protect);

// Routes that both admin and partner can access
router.get('/customer/:customerId', getCustomerUnits);
router.get('/partner/:partnerId', getPartnerUnits);
router.get('/:id', getUnitById);

// Admin-only routes
router.get('/', adminOnly, getAllUnits);
router.post('/', adminOnly, createUnit);
router.post('/partner', adminOnly, createPartnerUnit);
router.put('/:id', adminOnly, updateUnit);
router.delete('/:id', adminOnly, deleteUnit);

module.exports = router; 
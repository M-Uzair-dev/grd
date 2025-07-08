const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  getAllCustomers,
  getAllCustomersNested,
  getPartnerCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customer.controller');

// All routes are protected
router.use(protect);

// Admin-only routes
router.route('/')
  .get(adminOnly, getAllCustomers)
  .post(adminOnly, createCustomer);

router.get('/nested', adminOnly, getAllCustomersNested);

// Routes accessible by both admin and partner
router.get('/partner/:partnerId', getPartnerCustomers);

router.route('/:id')
  .get(getCustomerById)
  .put(adminOnly, updateCustomer)
  .delete(adminOnly, deleteCustomer);

module.exports = router; 
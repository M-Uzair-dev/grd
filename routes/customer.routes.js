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

// All routes are protected and admin-only
router.use(protect, adminOnly);

router.route('/')
  .get(getAllCustomers)
  .post(createCustomer);

router.get('/nested', getAllCustomersNested);
router.get('/partner/:partnerId', getPartnerCustomers);

router.route('/:id')
  .get(getCustomerById)
  .put(updateCustomer)
  .delete(deleteCustomer);

module.exports = router; 
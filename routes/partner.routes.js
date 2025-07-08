const express = require('express');
const router = express.Router();
const { protect, adminOnly, partnerOnly } = require('../middleware/auth.middleware');
const {
  getAllPartners,
  getAllPartnersNested,
  getAdminPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  updatePartnerPassword,
  deletePartner,
  getPartnerNested
} = require('../controllers/partner.controller');

// All routes are protected
router.use(protect);

// Partner routes
router.get('/nested/me', partnerOnly, getPartnerNested);

// Admin-only routes
router.use(adminOnly);

router.route('/')
  .get(getAllPartners)
  .post(createPartner);

router.get('/nested', getAllPartnersNested);
router.get('/admin', getAdminPartners);

router.route('/:id')
  .get(getPartnerById)
  .put(updatePartner)
  .delete(deletePartner);

router.put('/:id/password', updatePartnerPassword);

module.exports = router; 
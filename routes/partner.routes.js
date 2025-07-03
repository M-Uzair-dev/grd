const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  getAllPartners,
  getAllPartnersNested,
  getAdminPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  updatePartnerPassword,
  deletePartner
} = require('../controllers/partner.controller');

// All routes are protected and admin-only
router.use(protect, adminOnly);

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
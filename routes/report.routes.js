const express = require('express');
const router = express.Router();
const { protect, adminOnly, partnerOnly } = require('../middleware/auth.middleware');
const {
  getAllReports,
  getPartnerReports,
  getReportById,
  createReport,
  updateReport,
  updatePartnerNote,
  sendReportToCustomer,
  deleteReport,
  updatePdf
} = require('../controllers/report.controller');

// All routes are protected
router.use(protect);

// Admin routes
router.route('/')
  .get(adminOnly, getAllReports)
  .post(adminOnly, createReport);

// Get single report
router.get('/:id', adminOnly, getReportById);

router.route('/:id')
  .put(adminOnly, updateReport)
  .delete(adminOnly, deleteReport);

// Update PDF file
router.put('/:id/pdf', adminOnly, updatePdf);

// Partner routes
router.get('/partner', partnerOnly, getPartnerReports);
router.put('/:id/partner-note', partnerOnly, updatePartnerNote);
router.post('/:id/send', partnerOnly, sendReportToCustomer);

module.exports = router;
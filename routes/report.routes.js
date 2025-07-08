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
  updatePdf,
  downloadReport,
  markAsRead
} = require('../controllers/report.controller');

// All routes are protected
router.use(protect);

// Admin routes
router.route('/')
  .get(adminOnly, getAllReports)
  .post(adminOnly, createReport);

// Partner routes - these need to be before /:id routes
router.get('/partner', partnerOnly, getPartnerReports);
router.put('/:id/partner-note', partnerOnly, updatePartnerNote);
router.post('/:id/send', partnerOnly, sendReportToCustomer);
router.post('/:id/mark-read', partnerOnly, markAsRead);

// Get single report
router.get('/:id', protect, getReportById);

// Download report
router.get('/:id/download', protect, downloadReport);

// Update PDF file
router.put('/:id/pdf', adminOnly, updatePdf);

router.route('/:id')
  .put(adminOnly, updateReport)
  .delete(adminOnly, deleteReport);

module.exports = router;
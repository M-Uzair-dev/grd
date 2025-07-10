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
  markAsRead,
  sendToPartner,
  deleteReportFile,
  addReportFiles
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

// Download specific file from report
router.get('/:id/download/:fileId', protect, downloadReport);

// File management routes
router.post('/:id/files', adminOnly, addReportFiles);
router.delete('/:id/files/:fileId', adminOnly, deleteReportFile);

// Send report to partner
router.post('/:id/send-to-partner', adminOnly, sendToPartner);

router.route('/:id')
  .put(adminOnly, updateReport)
  .delete(adminOnly, deleteReport);

module.exports = router;
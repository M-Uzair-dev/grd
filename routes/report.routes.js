const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/reports';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Preserve original filename
    cb(null, file.originalname);
  }
});

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept all file types
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Maximum 10 files
  }
}).array('files', 10); // Allow up to 10 files per upload

// All routes are protected
router.use(protect);

// Admin routes
router.route('/')
  .get(adminOnly, getAllReports)
  .post(adminOnly, upload, createReport); // File upload route with multer middleware

// Partner routes - these need to be before /:id routes
router.get('/partner', partnerOnly, getPartnerReports);
router.put('/:id/partner-note', express.json(), partnerOnly, updatePartnerNote); // JSON route
router.post('/:id/send', express.json(), partnerOnly, sendReportToCustomer); // JSON route
router.post('/:id/mark-read', express.json(), partnerOnly, markAsRead); // JSON route

// Get single report
router.get('/:id', protect, getReportById);

// Download specific file from report
router.get('/:id/download/:fileId', protect, downloadReport);

// File management routes
router.post('/:id/files', adminOnly, upload, addReportFiles); // File upload route with multer middleware
router.delete('/:id/files/:fileId', adminOnly, deleteReportFile);

// Send report to partner
router.post('/:id/send-to-partner', express.json(), adminOnly, sendToPartner); // JSON route

router.route('/:id')
  .put(express.json(), adminOnly, updateReport) // JSON route
  .delete(adminOnly, deleteReport);

module.exports = router;
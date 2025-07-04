const express = require('express');
const router = express.Router();
const { 
  adminLogin, 
  partnerLogin, 
  forgotPassword, 
  resetPassword 
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Auth routes
router.post('/admin/login', adminLogin);
router.post('/partner/login', partnerLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:role/:token', resetPassword);

// Protected route example
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router; 
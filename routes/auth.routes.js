const express = require('express');
const router = express.Router();
const { 
  adminLogin, 
  partnerLogin, 
  forgotPassword, 
  resetPassword,
  changePassword 
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Auth routes
router.post('/admin/login', adminLogin);
router.post('/partner/login', partnerLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:role/:token', resetPassword);
router.post('/change-password', protect, changePassword);

// Protected route example
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router; 
const express = require('express');
const {
  getAdminStatus,
  loginAdmin,
  logoutAdmin,
  changePassword,
  forgotPassword,
  resetPassword,
} = require('../controllers/adminController');
const { requireAdminSession } = require('../middleware/adminAuth');

const router = express.Router();

router.get('/status', getAdminStatus);
router.post('/login', loginAdmin);
router.post('/logout', logoutAdmin);
router.post('/change-password', requireAdminSession, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;

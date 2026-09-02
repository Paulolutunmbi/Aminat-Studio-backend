const express = require('express');
const {
  getAdminStatus,
  setupAdmin,
  loginAdmin,
  logoutAdmin,
  forgotPassword,
  resetPassword,
} = require('../controllers/adminController');

const router = express.Router();

router.get('/status', getAdminStatus);
router.post('/setup', setupAdmin);
router.post('/login', loginAdmin);
router.post('/logout', logoutAdmin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;

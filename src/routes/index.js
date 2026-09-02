const express = require('express');
const settingsRoutes = require('./settingsRoutes');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Aminat Studio API is running',
    database: 'connected',
  });
});

router.use('/settings', settingsRoutes);

module.exports = router;

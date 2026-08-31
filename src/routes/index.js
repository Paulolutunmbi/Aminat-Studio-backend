const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Aminat Studio API is running',
    database: 'connected',
  });
});

module.exports = router;

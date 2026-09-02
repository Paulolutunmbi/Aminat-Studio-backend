const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { ensureInitialAdmin } = require('./services/adminBootstrap');
const artworkRoutes = require('./routes/artworkRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const frontendUrl = (process.env.FRONTEND_URL || '').trim();

const allowedOrigins = Array.from(
  new Set(
    [
      ...(frontendUrl ? frontendUrl.split(',').map((origin) => origin.trim()).filter(Boolean) : []),
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ].filter(Boolean)
  )
).map((origin) => origin.replace(/\/$/, ''));

app.use((req, res, next) => {
  const rawCookies = (req.headers.cookie || '').split(';');
  req.cookies = {};

  for (const cookie of rawCookies) {
    const [name, ...rest] = cookie.trim().split('=');

    if (!name) {
      continue;
    }

    req.cookies[name] = decodeURIComponent(rest.join('='));
  }

  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/artworks', artworkRoutes);

app.get('/api/health', (req, res) => {
  const databaseState = mongooseConnectionState();

  res.status(200).json({
    success: true,
    message: 'Aminat Studio API is running',
    database: databaseState,
  });
});

function mongooseConnectionState() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const mongoose = require('mongoose');
  return states[mongoose.connection.readyState] || 'unknown';
}

const startServer = async () => {
  try {
    await connectDB();
    await ensureInitialAdmin();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;

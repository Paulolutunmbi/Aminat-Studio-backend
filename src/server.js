const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const artworkRoutes = require('./routes/artworkRoutes');
const apiRoutes = require('./routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const frontendUrl = process.env.FRONTEND_URL;

const allowedOrigins = frontendUrl ? [frontendUrl] : [];

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

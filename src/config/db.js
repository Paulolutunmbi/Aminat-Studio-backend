const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('MongoDB connection failed: MONGODB_URI is missing from the environment variables.');
    throw new Error('MONGODB_URI is not defined');
  }

  try {
    const connection = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected successfully: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;

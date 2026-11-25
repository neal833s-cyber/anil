import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    logger.warn(`⚠️  MongoDB connection failed: ${error.message}`);
    logger.warn('💡 Backend starting without database. Install MongoDB or set MONGO_URI to a MongoDB Atlas connection string in backend/.env');
    // Don't exit — allow server to start for dev preview
    return false;
  }
};

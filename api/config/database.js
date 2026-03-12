const mongoose = require('mongoose');

async function connectDatabase() {
  try {
    // Check that the URI exists
    if (!process.env.MONGODB_URI) {
      throw new Error('❌ MONGODB_URI environment variable not defined');
    }

    console.log('🔌 Attempting MongoDB connection...');

    // Connect to MongoDB with extended timeouts and family: 4 to force IPv4
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
    });

    console.log(`✅ MongoDB connected to: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

module.exports = { connectDatabase };

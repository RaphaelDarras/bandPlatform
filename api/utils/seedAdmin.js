/**
 * Admin User Seeding Script
 *
 * Creates a default admin user for development/testing purposes.
 * Password is automatically hashed by Admin model's pre-save hook (bcrypt).
 *
 * Default credentials:
 * - Username: admin
 * - Email: admin@bandmerch.local
 * - Password: admin123!
 *
 * Usage: npm run seed:admin
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const Admin = require('../models/Admin');

async function seedAdmin() {
  try {
    // Connect to database
    await connectDatabase();

    // Check if admin user already exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });

    if (existingAdmin) {
      console.log('ℹ️  Admin already exists');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create new admin user
    const admin = await Admin.create({
      username: 'admin',
      email: 'admin@bandmerch.local',
      password: 'admin123!',
      role: 'admin',
      active: true,
    });

    console.log('✅ Admin user created successfully!');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: admin123!`);
    console.log('');
    console.log('⚠️  IMPORTANT: CHANGE DEFAULT PASSWORD IN PRODUCTION');

    // Close database connection
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
    console.error('Full error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the seeding script
seedAdmin();

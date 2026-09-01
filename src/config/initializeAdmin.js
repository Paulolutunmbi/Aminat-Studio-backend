const Admin = require('../models/Admin');
const { normalizeEmail, isValidEmail, hashPassword } = require('./auth');

const ensureInitialAdmin = async () => {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !initialPassword) {
    console.warn('Admin bootstrap skipped: ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD are not configured.');
    return null;
  }

  if (!isValidEmail(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }

  const existingAdmin = await Admin.findOne({ email });

  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await hashPassword(initialPassword);
  const admin = await Admin.create({
    email,
    passwordHash,
    isActive: true,
    sessionVersion: 1,
  });

  console.log('Initial admin account created successfully.');
  return admin;
};

module.exports = {
  ensureInitialAdmin,
};

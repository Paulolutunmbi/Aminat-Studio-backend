const Admin = require('../models/Admin');
const { hashPassword, isValidEmail, normalizeEmail } = require('../config/auth');

const ensureInitialAdmin = async () => {
  const configuredEmail = normalizeEmail(process.env.ADMIN_EMAIL);

  if (!configuredEmail || !isValidEmail(configuredEmail)) {
    throw new Error('ADMIN_EMAIL is missing or invalid.');
  }

  // Bootstrap is scoped to the configured account.  An unrelated document must
  // never prevent creation of the configured administrator.
  const existingAdmin = await Admin.findOne({ email: configuredEmail });
  if (existingAdmin) {
    return existingAdmin;
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    throw new Error('ADMIN_INITIAL_PASSWORD is required to bootstrap the first admin.');
  }

  const passwordHash = await hashPassword(initialPassword);

  try {
    return await Admin.create({
      email: configuredEmail,
      passwordHash,
      isActive: true,
      sessionVersion: 1,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return Admin.findOne({ email: configuredEmail });
    }

    throw error;
  }
};

module.exports = { ensureInitialAdmin };

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const cookieName = 'aminat_admin_session';
const defaultSessionDurationMs = 1000 * 60 * 60 * 24 * 7;
const sessionDurationMs = Number(process.env.SESSION_MAX_AGE_MS || defaultSessionDurationMs);
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const jwtSecret = (process.env.JWT_SECRET || '').trim();

if (!jwtSecret) {
  console.warn('JWT_SECRET is not set. Admin authentication cookies cannot be signed until it is configured.');
}

const normalizeEmail = (value = '') => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
};

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

const validatePasswordStrength = (value = '') => {
  const password = String(value);

  if (password.length < 8) {
    return false;
  }

  if (!/[a-z]/.test(password)) {
    return false;
  }

  if (!/[A-Z]/.test(password)) {
    return false;
  }

  if (!/\d/.test(password)) {
    return false;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return false;
  }

  return true;
};

const hashPassword = async (password) => bcrypt.hash(String(password), 12);

const comparePassword = async (password, passwordHash) => {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(String(password), String(passwordHash));
};

const signAdminSession = (admin) => {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is missing from the environment variables.');
  }

  const payload = {
    sub: String(admin._id || admin.id),
    email: normalizeEmail(admin.email),
    sessionVersion: Number(admin.sessionVersion || 1),
  };

  return jwt.sign(payload, jwtSecret, {
    expiresIn: `${Math.max(1, Math.floor(sessionDurationMs / 1000))}s`,
  });
};

const verifyAdminSession = (token) => {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is missing from the environment variables.');
  }

  return jwt.verify(token, jwtSecret);
};

const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const hashResetToken = (token) => crypto.createHash('sha256').update(String(token).trim()).digest('hex');

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: isProduction ? 'strict' : 'lax',
  secure: isProduction,
  maxAge: sessionDurationMs,
});

module.exports = {
  cookieName,
  normalizeEmail,
  isValidEmail,
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  signAdminSession,
  verifyAdminSession,
  generateResetToken,
  hashResetToken,
  getCookieOptions,
};

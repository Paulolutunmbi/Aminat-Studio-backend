const Admin = require('../models/Admin');
const {
  cookieName,
  normalizeEmail,
  isValidEmail,
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  signAdminSession,
  hashResetToken,
  generateResetToken,
  getCookieOptions,
  verifyAdminSession,
} = require('../config/auth');
const { sendPasswordResetEmail } = require('../services/emailService');

const setAuthCookie = (res, token) => {
  res.cookie(cookieName, token, {
    ...getCookieOptions(),
    expires: new Date(Date.now() + Number(process.env.SESSION_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000)),
  });
};

const clearAuthCookie = (res) => {
  const { httpOnly, sameSite, secure } = getCookieOptions();

  res.clearCookie(cookieName, {
    httpOnly,
    sameSite,
    secure,
  });
};

const readAuthState = async (req) => {
  if (!req.cookies || !req.cookies[cookieName]) {
    return { authenticated: false, admin: null };
  }

  try {
    const payload = verifyAdminSession(req.cookies[cookieName]);
    const admin = await Admin.findById(payload.sub);

    if (!admin || !admin.isActive || Number(payload.sessionVersion) !== Number(admin.sessionVersion || 1)) {
      return { authenticated: false, admin: null };
    }

    return {
      authenticated: true,
      admin: {
        id: admin._id,
        email: admin.email,
      },
    };
  } catch (error) {
    return { authenticated: false, admin: null };
  }
};

const getAdminStatus = async (req, res) => {
  const state = await readAuthState(req);

  // Authentication state must never be reused from a cache after login/logout.
  res.set('Cache-Control', 'no-store');

  return res.status(200).json({
    success: true,
    authenticated: state.authenticated,
  });
};

const loginAdmin = async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = String(req.body && req.body.password ? req.body.password : '');

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'A valid admin email is required.',
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required.',
    });
  }

  try {
    const admin = await Admin.findOne({ email }).select('+passwordHash');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This admin account is inactive.',
      });
    }

    const isPasswordValid = await comparePassword(password, admin.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const nextSessionVersion = Number(admin.sessionVersion || 1) + 1;
    const token = signAdminSession({
      _id: admin._id,
      email: admin.email,
      sessionVersion: nextSessionVersion,
    });

    admin.lastLoginAt = new Date();
    admin.sessionVersion = nextSessionVersion;
    await admin.save();

    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      authenticated: true,
      message: 'Admin login successful.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Admin login failed.',
    });
  }
};

const changePassword = async (req, res) => {
  const currentPassword = String(req.body && req.body.currentPassword ? req.body.currentPassword : '');
  const newPassword = String(req.body && req.body.newPassword ? req.body.newPassword : '');
  const confirmPassword = req.body && Object.prototype.hasOwnProperty.call(req.body, 'confirmPassword')
    ? String(req.body.confirmPassword || '')
    : newPassword;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  if (!validatePasswordStrength(newPassword)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.',
    });
  }

  try {
    const admin = await Admin.findById(req.admin.id).select('+passwordHash +sessionVersion');
    if (!admin || !admin.isActive || !(await comparePassword(currentPassword, admin.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    admin.passwordHash = await hashPassword(newPassword);
    admin.sessionVersion = Number(admin.sessionVersion || 1) + 1;
    await admin.save();
    clearAuthCookie(res);

    return res.status(200).json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Password change failed.' });
  }
};

const logoutAdmin = async (req, res) => {
  clearAuthCookie(res);

  return res.status(200).json({
    success: true,
    authenticated: false,
    message: 'Admin logged out successfully.',
  });
};

const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'A valid email is required.',
    });
  }

  const configuredAdminEmail = normalizeEmail(process.env.ADMIN_EMAIL);

  if (!configuredAdminEmail) {
    return res.status(500).json({
      success: false,
      message: 'Admin password reset is not configured yet.',
    });
  }

  if (email !== configuredAdminEmail) {
    return res.status(403).json({
      success: false,
      message: 'This email is not registered as an admin account.',
    });
  }

  try {
    const admin = await Admin.findOne({ email: configuredAdminEmail }).select('+passwordResetToken +passwordResetExpiresAt');

    if (!admin || !admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This email is not registered as an admin account.',
      });
    }

    const resetToken = generateResetToken();
    const resetTokenHash = hashResetToken(resetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    admin.passwordResetToken = resetTokenHash;
    admin.passwordResetExpiresAt = expiresAt;
    await admin.save();

    try {
      const emailResult = await sendPasswordResetEmail({
        email: admin.email,
        resetToken,
      });

      if (!emailResult || !emailResult.success) {
        throw new Error(emailResult && emailResult.message ? emailResult.message : 'Password reset email could not be sent.');
      }

      return res.status(200).json({
        success: true,
        message: 'A password reset link has been sent to the admin email.',
      });
    } catch (emailError) {
      console.error('Password reset email delivery failed:', emailError && emailError.message ? emailError.message : emailError);

      admin.passwordResetToken = null;
      admin.passwordResetExpiresAt = null;
      await admin.save();

      return res.status(503).json({
        success: false,
        message: 'We couldn\'t send the password reset email right now. Please try again later.',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Password reset request failed.',
    });
  }
};

const resetPassword = async (req, res) => {
  const token = String(req.body && req.body.token ? req.body.token : '');
  const newPassword = String(req.body && req.body.newPassword ? req.body.newPassword : '');
  const configuredAdminEmail = normalizeEmail(process.env.ADMIN_EMAIL);

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'This password reset link is invalid or has expired. Please request a new password reset.',
    });
  }

  if (!validatePasswordStrength(newPassword)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.',
    });
  }

  try {
    const tokenHash = hashResetToken(token);
    const admin = await Admin.findOne({
      email: configuredAdminEmail,
      passwordResetToken: tokenHash,
      isActive: true,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash +passwordResetToken +passwordResetExpiresAt +sessionVersion');

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link is invalid or has expired. Please request a new password reset.',
      });
    }

    const passwordHash = await hashPassword(newPassword);
    admin.passwordHash = passwordHash;
    admin.passwordResetToken = null;
    admin.passwordResetExpiresAt = null;
    admin.sessionVersion = Number(admin.sessionVersion || 1) + 1;
    await admin.save();

    clearAuthCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Password reset failed.',
    });
  }
};

module.exports = {
  getAdminStatus,
  loginAdmin,
  logoutAdmin,
  changePassword,
  forgotPassword,
  resetPassword,
};

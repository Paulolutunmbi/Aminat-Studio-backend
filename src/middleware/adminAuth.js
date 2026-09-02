const Admin = require('../models/Admin');
const { cookieName, verifyAdminSession } = require('../config/auth');

const requireAdminSession = async (req, res, next) => {
  const token = req.cookies && req.cookies[cookieName];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  try {
    const payload = verifyAdminSession(token);
    const admin = await Admin.findById(payload.sub).select('+passwordHash +sessionVersion');

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed.',
      });
    }

    if (Number(payload.sessionVersion) !== Number(admin.sessionVersion)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed.',
      });
    }

    req.admin = {
      id: admin._id,
      email: admin.email,
      sessionVersion: admin.sessionVersion,
      mustChangePassword: Boolean(admin.mustChangePassword),
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

const requireAdminAuth = async (req, res, next) => {
  return requireAdminSession(req, res, () => {
    if (req.admin.mustChangePassword) {
      return res.status(403).json({ success: false, message: 'Password change required.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    return next();
  });
};

module.exports = {
  requireAdminSession,
  requireAdminAuth,
};

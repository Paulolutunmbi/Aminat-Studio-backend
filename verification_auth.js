const Admin = require('./src/models/Admin');
const { hashPassword, hashResetToken } = require('./src/config/auth');
const { sendPasswordResetEmail } = require('./src/services/emailService');

const BASE = 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ORIGINAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
const TEMP_PASSWORD = 'TempAdmin!123';
const cookies = new Map();

function parseSetCookie(headers) {
  const setCookie = headers && typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const value of setCookie) {
    const match = String(value).match(/^([^=;]+)=([^;]+)/);
    if (!match) continue;
    cookies.set(match[1], match[2]);
  }
}

async function request(path, init = {}) {
  const method = init.method || 'GET';
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookies.size) {
    headers.set('Cookie', Array.from(cookies.entries()).map(([key, value]) => `${key}=${value}`).join('; '));
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'include',
  });

  parseSetCookie(response.headers);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text || null;
  }

  return { status: response.status, json };
}

(async () => {
  const summary = {};

  try {
    const health = await request('/api/health');
    summary.health = health.status;

    const publicArtworks = await request('/api/artworks');
    summary.publicArtworks = publicArtworks.status;

    const loggedOutStatus = await request('/api/admin/status');
    summary.loggedOutStatus = loggedOutStatus.status;
    summary.loggedOutAuthenticated = !!(loggedOutStatus.json && loggedOutStatus.json.authenticated);

    const login = await request('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ORIGINAL_PASSWORD } });
    summary.login = login.status;
    summary.loginAuthenticated = !!(login.json && login.json.authenticated);

    const loggedInStatus = await request('/api/admin/status');
    summary.loggedInStatus = loggedInStatus.status;
    summary.loggedInAuthenticated = !!(loggedInStatus.json && loggedInStatus.json.authenticated);

    const invalidLogin = await request('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: 'WrongPassword!123' } });
    summary.invalidLogin = invalidLogin.status;

    const guestCreate = await request('/api/artworks', {
      method: 'POST',
      body: { title: 'Temp', description: 'temp', medium: 'Test', year: '2026', imageUrl: 'https://example.com/image.jpg' },
    });
    summary.guestCreate = guestCreate.status;

    const authCreate = await request('/api/artworks', {
      method: 'POST',
      body: { title: 'Auth Temp Artwork', description: 'temp auth test', medium: 'Test', year: '2026', imageUrl: 'https://example.com/image.jpg' },
    });
    summary.authCreate = authCreate.status;
    const createdId = authCreate.json && authCreate.json.data && authCreate.json.data._id ? authCreate.json.data._id : null;
    if (createdId) {
      const deleteArtwork = await request(`/api/artworks/${createdId}`, { method: 'DELETE' });
      summary.deleteCreatedArtwork = deleteArtwork.status;
    }

    const logout = await request('/api/admin/logout', { method: 'POST' });
    summary.logout = logout.status;

    const afterLogoutStatus = await request('/api/admin/status');
    summary.afterLogoutStatus = afterLogoutStatus.status;
    summary.afterLogoutAuthenticated = !!(afterLogoutStatus.json && afterLogoutStatus.json.authenticated);

    const forgot = await request('/api/admin/forgot-password', { method: 'POST', body: { email: ADMIN_EMAIL } });
    summary.forgotPassword = forgot.status;

    const resendEmail = await sendPasswordResetEmail({ email: ADMIN_EMAIL, resetToken: `dev-reset-${Date.now()}` });
    summary.resendEmail = {
      success: !!(resendEmail && resendEmail.success),
      skipped: !!(resendEmail && resendEmail.skipped),
      provider: resendEmail && resendEmail.provider ? resendEmail.provider : null,
      message: resendEmail && resendEmail.message ? resendEmail.message : null,
    };

    const token = `reset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const admin = await Admin.findOne({ email: ADMIN_EMAIL }).select('+passwordHash +passwordResetToken +passwordResetExpiresAt +sessionVersion');
    if (!admin) throw new Error('Admin account missing for reset validation');
    admin.passwordResetToken = hashResetToken(token);
    admin.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await admin.save();

    const reset = await request('/api/admin/reset-password', { method: 'POST', body: { token, newPassword: TEMP_PASSWORD } });
    summary.resetPassword = reset.status;
    summary.resetPasswordSuccess = !!(reset.json && reset.json.success);

    const oldSessionStatus = await request('/api/admin/status');
    summary.oldSessionStatus = oldSessionStatus.status;
    summary.oldSessionAuthenticated = !!(oldSessionStatus.json && oldSessionStatus.json.authenticated);

    const loginWithNewPassword = await request('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: TEMP_PASSWORD } });
    summary.loginWithNewPassword = loginWithNewPassword.status;
    summary.loginWithNewPasswordAuthenticated = !!(loginWithNewPassword.json && loginWithNewPassword.json.authenticated);

    const currentAdmin = await Admin.findOne({ email: ADMIN_EMAIL }).select('+passwordHash +sessionVersion +passwordResetToken +passwordResetExpiresAt');
    if (!currentAdmin) throw new Error('Admin account missing after reset');
    currentAdmin.passwordHash = await hashPassword(ORIGINAL_PASSWORD);
    currentAdmin.passwordResetToken = null;
    currentAdmin.passwordResetExpiresAt = null;
    currentAdmin.sessionVersion = Number(currentAdmin.sessionVersion || 1) + 1;
    await currentAdmin.save();

    const loginBack = await request('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ORIGINAL_PASSWORD } });
    summary.loginBack = loginBack.status;
    summary.loginBackAuthenticated = !!(loginBack.json && loginBack.json.authenticated);

    const finalLogout = await request('/api/admin/logout', { method: 'POST' });
    summary.finalLogout = finalLogout.status;

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    summary.error = error.message;
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
  }
})();

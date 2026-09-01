const Admin = require('./src/models/Admin');
const { hashPassword, hashResetToken } = require('./src/config/auth');
const { sendPasswordResetEmail } = require('./src/services/emailService');

const BASE = 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ORIGINAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
const TEMP_PASSWORD = 'TempAdmin!123';
const cookies = new Map();

const smallDataPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAF' +
  'c4CBDAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJ0UkG' +
  'AAAAAAgI0pRjAAAAAElFTkSuQmCC';

function parseSetCookie(headers) {
  const raw = headers && typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const entry of raw) {
    const match = String(entry).match(/^([^=;]+)=([^;]+)/);
    if (!match) continue;
    cookies.set(match[1], match[2]);
  }
}

function getCookieHeader() {
  return Array.from(cookies.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
}

async function request(path, init = {}) {
  const method = init.method || 'GET';
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookies.size > 0) {
    headers.set('Cookie', getCookieHeader());
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

function clearCookieJar() {
  for (const key of Array.from(cookies.keys())) {
    cookies.delete(key);
  }
}

(async () => {
  const summary = {};

  try {
    const health = await request('/api/health');
    summary.health = health.status;

    const artworks = await request('/api/artworks');
    summary.publicArtworks = artworks.status;

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

    const authCreate = await request('/api/artworks', {
      method: 'POST',
      body: {
        title: 'Auth Flow Temp Artwork',
        description: 'temporary auth validation',
        medium: 'Test',
        year: '2026',
        imageUrl: smallDataPng,
      },
    });
    summary.authCreate = authCreate.status;
    const createdId = authCreate.json && authCreate.json.data && authCreate.json.data._id ? authCreate.json.data._id : null;
    if (createdId) {
      const deleteTemp = await request(`/api/artworks/${createdId}`, { method: 'DELETE' });
      summary.deleteCreatedArtwork = deleteTemp.status;
    }

    const guestCreate = await request('/api/artworks', {
      method: 'POST',
      body: {
        title: 'Unauthorized Temp Artwork',
        description: 'should fail',
        medium: 'Test',
        year: '2026',
        imageUrl: smallDataPng,
      },
      headers: { Authorization: 'Bearer invalid' },
    });
    summary.guestCreate = guestCreate.status;

    const logout = await request('/api/admin/logout', { method: 'POST' });
    summary.logout = logout.status;
    clearCookieJar();

    const afterLogoutStatus = await request('/api/admin/status');
    summary.afterLogoutStatus = afterLogoutStatus.status;
    summary.afterLogoutAuthenticated = !!(afterLogoutStatus.json && afterLogoutStatus.json.authenticated);

    const forgot = await request('/api/admin/forgot-password', { method: 'POST', body: { email: ADMIN_EMAIL } });
    summary.forgotPassword = forgot.status;

    try {
      const resendEmail = await sendPasswordResetEmail({ email: ADMIN_EMAIL, resetToken: `dev-reset-${Date.now()}` });
      summary.resendEmail = {
        success: !!(resendEmail && resendEmail.success),
        skipped: !!(resendEmail && resendEmail.skipped),
        provider: resendEmail && resendEmail.provider ? resendEmail.provider : null,
      };
    } catch (error) {
      summary.resendEmail = {
        success: false,
        skipped: false,
        provider: 'resend',
        error: error.message,
      };
    }

    const token = `reset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const admin = await Admin.findOne({ email: ADMIN_EMAIL }).select('+passwordHash +passwordResetToken +passwordResetExpiresAt +sessionVersion');
    if (!admin) throw new Error('Admin account is missing.');

    const loginForReset = await request('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ORIGINAL_PASSWORD } });
    summary.loginForReset = loginForReset.status;
    summary.loginForResetAuthenticated = !!(loginForReset.json && loginForReset.json.authenticated);

    const oldCookieHeader = getCookieHeader();
    admin.passwordResetToken = hashResetToken(token);
    admin.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    admin.sessionVersion = Number(admin.sessionVersion || 1) + 1;
    await admin.save();

    const reset = await request('/api/admin/reset-password', { method: 'POST', body: { token, newPassword: TEMP_PASSWORD } });
    summary.resetPassword = reset.status;
    summary.resetPasswordSuccess = !!(reset.json && reset.json.success);

    const oldSessionStatusAfterReset = await request('/api/admin/status');
    summary.oldSessionStatusAfterReset = oldSessionStatusAfterReset.status;
    summary.oldSessionAuthenticated = !!(oldSessionStatusAfterReset.json && oldSessionStatusAfterReset.json.authenticated);

    const loginWithNewPassword = await request('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: TEMP_PASSWORD } });
    summary.loginWithNewPassword = loginWithNewPassword.status;
    summary.loginWithNewPasswordAuthenticated = !!(loginWithNewPassword.json && loginWithNewPassword.json.authenticated);

    const currentAdmin = await Admin.findOne({ email: ADMIN_EMAIL }).select('+passwordHash +sessionVersion +passwordResetToken +passwordResetExpiresAt');
    if (!currentAdmin) throw new Error('Admin record was not found after reset.');
    currentAdmin.passwordHash = await hashPassword(ORIGINAL_PASSWORD);
    currentAdmin.passwordResetToken = null;
    currentAdmin.passwordResetExpiresAt = null;
    currentAdmin.sessionVersion = Number(currentAdmin.sessionVersion || 1) + 1;
    await currentAdmin.save();

    clearCookieJar();
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

const DEFAULT_RESEND_SENDER = 'onboarding@resend.dev';

const getResendSenderAddress = () => {
  const configuredSender = (process.env.RESEND_FROM_EMAIL || '').trim();
  return configuredSender || DEFAULT_RESEND_SENDER;
};

const buildPasswordResetUrl = (resetToken) => {
  const baseUrl = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');

  if (!baseUrl) {
    return `reset-token:${resetToken}`;
  }

  return `${baseUrl}/admin/reset-password?token=${encodeURIComponent(resetToken)}`;
};

const sendPasswordResetEmail = async ({ email, resetToken }) => {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const senderAddress = getResendSenderAddress();

  if (!apiKey) {
    return {
      success: false,
      skipped: true,
      provider: 'resend',
      message: 'Password reset email is not configured yet.',
    };
  }

  const resetUrl = buildPasswordResetUrl(resetToken);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderAddress,
        to: [email],
        subject: 'Aminat Studio admin password reset',
        html: `
          <p>We received a request to reset your Aminat Studio admin password.</p>
          <p>Use the following link to continue:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link expires in 15 minutes.</p>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `Resend request failed with status ${response.status}.`);
    }

    return {
      success: true,
      skipped: false,
      provider: 'resend',
    };
  } catch (error) {
    const errorMessage = error && error.message ? error.message : 'Unable to send password reset email.';
    return {
      success: false,
      skipped: false,
      provider: 'resend',
      message: errorMessage,
    };
  }
};

module.exports = {
  sendPasswordResetEmail,
  buildPasswordResetUrl,
  getResendSenderAddress,
};

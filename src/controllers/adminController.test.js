const test = require('node:test');
const assert = require('node:assert/strict');
const Admin = require('../models/Admin');
const controller = require('./adminController');

const withMockedEnv = async (callback) => {
  const originalEnv = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = 'aminatstudio0@gmail.com';
  try {
    await callback();
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = originalEnv;
    }
  }
};

test('forgotPassword rejects emails that are not the configured admin account', async () => {
  await withMockedEnv(async () => {
    const originalFindOne = Admin.findOne;
    const calls = [];

    Admin.findOne = async (query) => {
      calls.push(query);
      return null;
    };

    try {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };

      await controller.forgotPassword({ body: { email: 'someone@example.com' } }, res);

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /not registered as an admin account/i);
      assert.deepEqual(calls, []);
    } finally {
      Admin.findOne = originalFindOne;
    }
  });
});

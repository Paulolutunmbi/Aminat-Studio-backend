const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { ensureInitialAdmin } = require('./adminBootstrap');

const withEnv = async (callback, initialPassword = 'Initial!Password9') => {
  const originalEmail = process.env.ADMIN_EMAIL;
  const originalPassword = process.env.ADMIN_INITIAL_PASSWORD;
  process.env.ADMIN_EMAIL = ' AminatStudio0@GMAIL.COM ';
  process.env.ADMIN_INITIAL_PASSWORD = initialPassword;
  try {
    await callback();
  } finally {
    if (originalEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalEmail;
    if (originalPassword === undefined) delete process.env.ADMIN_INITIAL_PASSWORD;
    else process.env.ADMIN_INITIAL_PASSWORD = originalPassword;
  }
};

test('bootstrap creates a bcrypt-hashed admin requiring a password change', async () => {
  await withEnv(async () => {
    const originalFindOne = Admin.findOne;
    const originalCreate = Admin.create;
    let created;
    Admin.findOne = async () => null;
    Admin.create = async (admin) => {
      created = admin;
      return admin;
    };
    try {
      await ensureInitialAdmin();
      assert.equal(created.email, 'aminatstudio0@gmail.com');
      assert.equal(created.mustChangePassword, true);
      assert.match(created.passwordHash, /^\$2[aby]\$/);
      assert.equal(created.passwordHash.includes('Initial!Password9'), false);
      assert.equal(await bcrypt.compare('Initial!Password9', created.passwordHash), true);
    } finally {
      Admin.findOne = originalFindOne;
      Admin.create = originalCreate;
    }
  });
});

test('bootstrap does not overwrite an existing admin password', async () => {
  await withEnv(async () => {
    const existing = { email: 'aminatstudio0@gmail.com', passwordHash: 'existing-hash', mustChangePassword: false };
    const originalFindOne = Admin.findOne;
    const originalCreate = Admin.create;
    let createCalled = false;
    Admin.findOne = async () => existing;
    Admin.create = async () => { createCalled = true; };
    try {
      const result = await ensureInitialAdmin();
      assert.equal(result, existing);
      assert.equal(createCalled, false);
      assert.equal(existing.passwordHash, 'existing-hash');
    } finally {
      Admin.findOne = originalFindOne;
      Admin.create = originalCreate;
    }
  });
});

test('bootstrap fails without an initial password only when creation is needed', async () => {
  await withEnv(async () => {
    const originalFindOne = Admin.findOne;
    const originalPassword = process.env.ADMIN_INITIAL_PASSWORD;
    delete process.env.ADMIN_INITIAL_PASSWORD;
    Admin.findOne = async () => null;
    try {
      await assert.rejects(ensureInitialAdmin, /ADMIN_INITIAL_PASSWORD is required/);
    } finally {
      process.env.ADMIN_INITIAL_PASSWORD = originalPassword;
      Admin.findOne = originalFindOne;
    }
  });
});

test('bootstrap tolerates a concurrent duplicate and returns the existing admin', async () => {
  await withEnv(async () => {
    const existing = { email: 'aminatstudio0@gmail.com' };
    const originalFindOne = Admin.findOne;
    const originalCreate = Admin.create;
    let findCalls = 0;
    Admin.findOne = async () => {
      findCalls += 1;
      return findCalls === 1 ? null : existing;
    };
    Admin.create = async () => {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    };
    try {
      assert.equal(await ensureInitialAdmin(), existing);
    } finally {
      Admin.findOne = originalFindOne;
      Admin.create = originalCreate;
    }
  });
});

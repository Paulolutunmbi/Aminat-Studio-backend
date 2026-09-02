const test = require('node:test');
const assert = require('node:assert/strict');
const Admin = require('../models/Admin');
const controller = require('./adminController');
const bcrypt = require('bcryptjs');

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

const createResponse = () => ({
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
});

test('setupAdmin rejects mismatched passwords before database access', async () => {
  await withMockedEnv(async () => {
    const originalFindOne = Admin.findOne;
    let findCalled = false;
    Admin.findOne = async () => {
      findCalled = true;
      return null;
    };

    try {
      const res = createResponse();
      await controller.setupAdmin({ body: { newPassword: 'Strong!Password9', confirmPassword: 'Different!Password9' }, ip: 'setup-mismatch' }, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.message, 'Passwords do not match.');
      assert.equal(findCalled, false);
    } finally {
      Admin.findOne = originalFindOne;
    }
  });
});

test('setupAdmin rejects weak passwords before database access', async () => {
  await withMockedEnv(async () => {
    const originalFindOne = Admin.findOne;
    let findCalled = false;
    Admin.findOne = async () => {
      findCalled = true;
      return null;
    };

    try {
      const res = createResponse();
      await controller.setupAdmin({ body: { newPassword: 'weakpassword', confirmPassword: 'weakpassword' }, ip: 'setup-weak' }, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /at least 8 characters/i);
      assert.equal(findCalled, false);
    } finally {
      Admin.findOne = originalFindOne;
    }
  });
});

test('setupAdmin creates one hashed admin account for the configured email', async () => {
  await withMockedEnv(async () => {
    const originalFindOne = Admin.findOne;
    const originalCreate = Admin.create;
    let createdAdmin;

    Admin.findOne = async () => null;
    Admin.create = async (admin) => {
      createdAdmin = admin;
      return admin;
    };

    try {
      const res = createResponse();
      await controller.setupAdmin({ body: { newPassword: 'Strong!Password9', confirmPassword: 'Strong!Password9' }, ip: 'setup-success' }, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(createdAdmin.email, 'aminatstudio0@gmail.com');
      assert.notEqual(createdAdmin.passwordHash, 'Strong!Password9');
      assert.equal(await bcrypt.compare('Strong!Password9', createdAdmin.passwordHash), true);
    } finally {
      Admin.findOne = originalFindOne;
      Admin.create = originalCreate;
    }
  });
});

test('setupAdmin rejects initialization when an admin already exists', async () => {
  await withMockedEnv(async () => {
    const originalFindOne = Admin.findOne;
    const originalCreate = Admin.create;
    let createCalled = false;

    Admin.findOne = async () => ({ _id: 'existing-admin' });
    Admin.create = async () => {
      createCalled = true;
    };

    try {
      const res = createResponse();
      await controller.setupAdmin({ body: { newPassword: 'Strong!Password9', confirmPassword: 'Strong!Password9' }, ip: 'setup-existing' }, res);

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.message, 'Admin setup is no longer available.');
      assert.equal(createCalled, false);
    } finally {
      Admin.findOne = originalFindOne;
      Admin.create = originalCreate;
    }
  });
});

test('setupAdmin treats a concurrent duplicate-key result as unavailable', async () => {
  await withMockedEnv(async () => {
    const originalFindOne = Admin.findOne;
    const originalCreate = Admin.create;

    Admin.findOne = async () => null;
    Admin.create = async () => {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    };

    try {
      const res = createResponse();
      await controller.setupAdmin({ body: { newPassword: 'Strong!Password9', confirmPassword: 'Strong!Password9' }, ip: 'setup-race' }, res);

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.message, 'Admin setup is no longer available.');
    } finally {
      Admin.findOne = originalFindOne;
      Admin.create = originalCreate;
    }
  });
});

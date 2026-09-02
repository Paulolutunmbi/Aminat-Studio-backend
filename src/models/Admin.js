const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Admin email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Admin email is invalid.'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Admin password hash is required.'],
      trim: true,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    sessionVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

adminSchema.pre('save', function normalizeAdmin() {
  if (this.email && typeof this.email === 'string') {
    this.email = this.email.trim().toLowerCase();
  }

  if (this.passwordHash && typeof this.passwordHash === 'string') {
    this.passwordHash = this.passwordHash.trim();
  }

  if (typeof this.isActive !== 'boolean') {
    this.isActive = Boolean(this.isActive);
  }
});

module.exports = mongoose.model('Admin', adminSchema);

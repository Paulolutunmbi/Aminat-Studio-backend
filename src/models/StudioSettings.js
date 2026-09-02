const mongoose = require('mongoose');

const studioSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'site-settings',
      unique: true,
      trim: true,
    },
    studioName: {
      type: String,
      default: 'Aminat Studio',
      trim: true,
    },
    artistName: {
      type: String,
      default: 'Aminat',
      trim: true,
    },
    description: {
      type: String,
      default: 'An emerging, self-taught artist inspired by nature.',
      trim: true,
    },
    email: {
      type: String,
      default: 'aminatstudio0@gmail.com',
      trim: true,
    },
    youtube: {
      type: String,
      default: '',
      trim: true,
    },
    tiktok: {
      type: String,
      default: '',
      trim: true,
    },
    profileImage: {
      type: String,
      default: '/images/profile/aminat-profile.jpg',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

studioSettingsSchema.pre('save', function normalizeSettings() {
  if (this.key && typeof this.key === 'string') {
    this.key = this.key.trim();
  }

  Object.keys(this.toObject()).forEach((field) => {
    if (typeof this[field] === 'string') {
      this[field] = this[field].trim();
    }
  });
});

module.exports = mongoose.model('StudioSettings', studioSettingsSchema);

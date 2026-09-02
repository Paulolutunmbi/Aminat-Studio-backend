const express = require('express');
const { requireAdminAuth } = require('../middleware/adminAuth');
const StudioSettings = require('../models/StudioSettings');

const router = express.Router();

const defaultSettings = {
  key: 'site-settings',
  studioName: 'Aminat Studio',
  artistName: 'Aminat',
  description: 'An emerging, self-taught artist inspired by nature.',
  email: 'aminatstudio0@gmail.com',
  youtube: 'https://youtube.com/@amesmeenah26',
  tiktok: 'https://www.tiktok.com/@m.nh1450',
  profileImage: '/images/profile/aminat-profile.jpg',
};

const normalizeSettingsPayload = (body = {}) => ({
  studioName: typeof body.studioName === 'string' ? body.studioName.trim() : defaultSettings.studioName,
  artistName: typeof body.artistName === 'string' ? body.artistName.trim() : defaultSettings.artistName,
  description: typeof body.description === 'string' ? body.description.trim() : defaultSettings.description,
  email: typeof body.email === 'string' ? body.email.trim() : defaultSettings.email,
  youtube: typeof body.youtube === 'string' ? body.youtube.trim() : defaultSettings.youtube,
  tiktok: typeof body.tiktok === 'string' ? body.tiktok.trim() : defaultSettings.tiktok,
  profileImage: typeof body.profileImage === 'string' ? body.profileImage.trim() : defaultSettings.profileImage,
});

router.get('/', async (req, res) => {
  try {
    const settings = await StudioSettings.findOne({ key: 'site-settings' }).lean();

    if (!settings) {
      const createdSettings = await StudioSettings.create(defaultSettings);
      return res.status(200).json({ success: true, data: createdSettings });
    }

    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load settings.', error: error.message });
  }
});

router.put('/', requireAdminAuth, async (req, res) => {
  try {
    const payload = normalizeSettingsPayload(req.body);

    const settings = await StudioSettings.findOneAndUpdate(
      { key: 'site-settings' },
      { $set: payload },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Studio settings updated successfully.',
      data: settings,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to save settings.' });
  }
});

module.exports = router;

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const cloudinary = require('cloudinary').v2;

const cloudinaryUrl = (process.env.CLOUDINARY_URL || '').trim();

if (!cloudinaryUrl) {
  throw new Error('CLOUDINARY_URL is missing from the environment variables.');
}

cloudinary.config({
  cloudinary_url: cloudinaryUrl,
  secure: true,
});

module.exports = cloudinary;

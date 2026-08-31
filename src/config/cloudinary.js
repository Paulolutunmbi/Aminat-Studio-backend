require('dotenv').config();

const cloudinary = require('cloudinary').v2;

const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (!cloudinaryUrl) {
  throw new Error('CLOUDINARY_URL is missing from the environment variables.');
}

cloudinary.config({
  cloudinary_url: cloudinaryUrl,
  secure: true,
});

module.exports = cloudinary;

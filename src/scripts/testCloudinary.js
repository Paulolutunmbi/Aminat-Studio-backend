require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { uploadArtworkImage, deleteArtworkImage } = require('../services/cloudinaryService');

const runCloudinaryTest = async () => {
  const tempDir = path.join(__dirname, '..', '..', '.tmp');
  const tempImagePath = path.join(tempDir, 'cloudinary-test.svg');

  fs.mkdirSync(tempDir, { recursive: true });

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <rect width="40" height="40" fill="#d97706"/>
      <circle cx="20" cy="20" r="12" fill="#ffffff"/>
    </svg>
  `;

  fs.writeFileSync(tempImagePath, svgContent.trim());

  try {
    console.log('Testing Cloudinary upload...');
    const uploadResult = await uploadArtworkImage(tempImagePath);

    if (!uploadResult.secureUrl || !uploadResult.publicId) {
      throw new Error('Cloudinary upload response missing expected secure URL or public ID.');
    }

    console.log('Upload test passed: secure URL returned and public ID generated.');
    console.log(`Public ID: ${uploadResult.publicId}`);

    console.log('Testing Cloudinary delete...');
    const deleteResult = await deleteArtworkImage(uploadResult.publicId);

    if (!deleteResult.success) {
      throw new Error('Cloudinary deletion did not succeed.');
    }

    console.log('Delete test passed: uploaded asset was removed successfully.');
    console.log(`Delete result: ${deleteResult.result}`);
  } finally {
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
  }
};

runCloudinaryTest().catch((error) => {
  console.error('Cloudinary test failed:', error.message);
  process.exit(1);
});

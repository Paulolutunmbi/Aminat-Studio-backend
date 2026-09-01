const { Readable } = require('stream');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');

const ARTWORK_FOLDER = 'aminat-studio/artworks';

const decodeDataUrlToBuffer = (dataUrl) => {
  if (typeof dataUrl !== 'string') {
    return null;
  }

  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid base64 image data URL.');
  }

  return Buffer.from(match[2], 'base64');
};

const uploadBufferToCloudinary = async (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: ARTWORK_FOLDER,
        resource_type: 'image',
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

const resolveUploadSource = (file) => {
  if (!file) {
    throw new Error('No image file provided for upload.');
  }

  if (typeof file === 'string') {
    const trimmed = file.trim();

    if (trimmed.startsWith('data:')) {
      return { type: 'buffer', value: decodeDataUrlToBuffer(trimmed) };
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return { type: 'remote-url', value: trimmed };
    }

    if (!fs.existsSync(trimmed)) {
      throw new Error('Image file path does not exist.');
    }

    return { type: 'path', value: trimmed };
  }

  if (Buffer.isBuffer(file)) {
    return { type: 'buffer', value: file };
  }

  if (file.path) {
    const value = String(file.path).trim();

    if (value.startsWith('data:')) {
      return { type: 'buffer', value: decodeDataUrlToBuffer(value) };
    }

    if (!fs.existsSync(value)) {
      throw new Error('Image file path does not exist.');
    }

    return { type: 'path', value };
  }

  if (file.buffer && Buffer.isBuffer(file.buffer)) {
    return { type: 'buffer', value: file.buffer };
  }

  if (file.data && Buffer.isBuffer(file.data)) {
    return { type: 'buffer', value: file.data };
  }

  throw new Error('Unsupported image file payload.');
};

const uploadArtworkImage = async (file) => {
  try {
    const uploadSource = resolveUploadSource(file);
    const uploadOptions = {
      folder: ARTWORK_FOLDER,
      resource_type: 'image',
      unique_filename: true,
      overwrite: false,
      fetch_format: 'auto',
      quality: 'auto',
    };

    let result;

    if (uploadSource.type === 'path') {
      result = await cloudinary.uploader.upload(uploadSource.value, uploadOptions);
    } else if (uploadSource.type === 'remote-url') {
      result = await cloudinary.uploader.upload(uploadSource.value, uploadOptions);
    } else {
      result = await uploadBufferToCloudinary(uploadSource.value);
    }

    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
      assetId: result.asset_id,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    const message = error?.message || 'Cloudinary upload failed.';
    throw new Error(`Artwork image upload failed: ${message}`);
  }
};

const deleteArtworkImage = async (publicId) => {
  if (!publicId || typeof publicId !== 'string') {
    throw new Error('A valid Cloudinary public_id is required.');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    if (result?.result === 'ok' || result?.result === 'not_found') {
      return {
        success: true,
        result: result.result,
        publicId,
      };
    }

    throw new Error(result?.error?.message || 'Cloudinary delete request failed.');
  } catch (error) {
    const message = error?.message || 'Cloudinary delete failed.';
    throw new Error(`Artwork image deletion failed: ${message}`);
  }
};

module.exports = {
  ARTWORK_FOLDER,
  uploadArtworkImage,
  deleteArtworkImage,
};

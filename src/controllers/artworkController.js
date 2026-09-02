const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const { deleteArtworkImage, uploadArtworkImage } = require('../services/cloudinaryService');

const FEATURED_LIMIT = 3;
const FEATURED_LIMIT_MESSAGE = 'Only 3 artworks can be featured at a time. Please remove one of the current featured artworks before featuring another.';

const allowedUpdateFields = [
  'title',
  'description',
  'medium',
  'year',
  'featured',
  'imageUrl',
  'image',
  'category',
  'dimensions',
  'cloudinaryPublicId',
  'order',
  'sortOrder',
];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const isDataUrl = (value) => typeof value === 'string' && /^data:image\//i.test(value.trim());
const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());
const isCloudinaryUrl = (value) => typeof value === 'string' && /cloudinary\.com/i.test(value);

const getFeaturedLimitError = ({ id, featured, featuredCount }) => {
  if (featured !== true) {
    return null;
  }

  if (Number(featuredCount) >= FEATURED_LIMIT) {
    return FEATURED_LIMIT_MESSAGE;
  }

  return null;
};

const safeDeleteArtworkImage = async (publicId) => {
  if (!publicId) {
    return null;
  }

  try {
    return await deleteArtworkImage(publicId);
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const syncArtworkImage = async (existingArtwork, incomingImageValue, replaceExisting = false) => {
  if (incomingImageValue === undefined || incomingImageValue === null) {
    return null;
  }

  const nextValue = typeof incomingImageValue === 'string' ? incomingImageValue.trim() : incomingImageValue;

  if (!nextValue) {
    return {
      imageUrl: '',
      image: '',
      cloudinaryPublicId: null,
    };
  }

  const isFrontendAssetPath = typeof nextValue === 'string' && nextValue.startsWith('/images/');

  if (isFrontendAssetPath || nextValue.startsWith('/')) {
    if (replaceExisting && existingArtwork?.cloudinaryPublicId && existingArtwork.cloudinaryPublicId !== nextValue) {
      await safeDeleteArtworkImage(existingArtwork.cloudinaryPublicId);
    }

    return {
      imageUrl: nextValue,
      image: nextValue,
      cloudinaryPublicId: null,
    };
  }

  if (typeof nextValue === 'string' && (isDataUrl(nextValue) || isHttpUrl(nextValue))) {
    if (replaceExisting && existingArtwork?.cloudinaryPublicId && existingArtwork.imageUrl !== nextValue) {
      await safeDeleteArtworkImage(existingArtwork.cloudinaryPublicId);
    }

    const result = await uploadArtworkImage(nextValue);

    return {
      imageUrl: result.secureUrl,
      image: result.secureUrl,
      cloudinaryPublicId: result.publicId,
    };
  }

  if (typeof nextValue === 'string' && nextValue.startsWith('data:')) {
    if (replaceExisting && existingArtwork?.cloudinaryPublicId && existingArtwork.imageUrl !== nextValue) {
      await safeDeleteArtworkImage(existingArtwork.cloudinaryPublicId);
    }

    const result = await uploadArtworkImage(nextValue);

    return {
      imageUrl: result.secureUrl,
      image: result.secureUrl,
      cloudinaryPublicId: result.publicId,
    };
  }

  if (typeof nextValue === 'string' && /^file:\/\//i.test(nextValue)) {
    if (replaceExisting && existingArtwork?.cloudinaryPublicId && existingArtwork.imageUrl !== nextValue) {
      await safeDeleteArtworkImage(existingArtwork.cloudinaryPublicId);
    }

    const result = await uploadArtworkImage(nextValue.replace(/^file:\/\//i, ''));

    return {
      imageUrl: result.secureUrl,
      image: result.secureUrl,
      cloudinaryPublicId: result.publicId,
    };
  }

  if (replaceExisting && existingArtwork?.cloudinaryPublicId && existingArtwork.imageUrl !== nextValue) {
    await safeDeleteArtworkImage(existingArtwork.cloudinaryPublicId);
  }

  return {
    imageUrl: nextValue,
    image: nextValue,
    cloudinaryPublicId: isCloudinaryUrl(nextValue) ? existingArtwork?.cloudinaryPublicId || null : null,
  };
};

const buildArtworkPayload = (body) => {
  const payload = {};

  for (const field of allowedUpdateFields) {
    if (typeof body[field] !== 'undefined') {
      payload[field] = body[field];
    }
  }

  if (payload.title !== undefined && typeof payload.title !== 'string') {
    throw new Error('Artwork title must be a string.');
  }

  if (payload.title !== undefined && !payload.title.trim()) {
    throw new Error('Artwork title cannot be empty.');
  }

  if (payload.imageUrl !== undefined && typeof payload.imageUrl !== 'string') {
    throw new Error('Artwork imageUrl must be a string.');
  }

  if (payload.imageUrl !== undefined && !payload.imageUrl.trim()) {
    throw new Error('Artwork imageUrl cannot be empty.');
  }

  if (payload.featured !== undefined && typeof payload.featured !== 'boolean') {
    throw new Error('Artwork featured must be a boolean.');
  }

  if (payload.image !== undefined && typeof payload.image !== 'string') {
    throw new Error('Artwork image must be a string.');
  }

  if (payload.year !== undefined && payload.year !== null && typeof payload.year !== 'string' && typeof payload.year !== 'number') {
    throw new Error('Artwork year must be a string, number, or null.');
  }

  if (payload.order !== undefined && (typeof payload.order !== 'number' || !Number.isFinite(payload.order))) {
    payload.order = Number(payload.order);
  }

  if (payload.sortOrder !== undefined && (typeof payload.sortOrder !== 'number' || !Number.isFinite(payload.sortOrder))) {
    payload.sortOrder = Number(payload.sortOrder);
  }

  return payload;
};

const getArtworks = async (req, res) => {
  try {
    const artworks = await Artwork.find({}).sort({ order: 1, sortOrder: 1, createdAt: -1, _id: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: artworks.length,
      data: artworks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch artworks.',
      error: error.message,
    });
  }
};

const getArtworkById = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid artwork ID.',
    });
  }

  try {
    const artwork = await Artwork.findById(id);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        message: 'Artwork not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: artwork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch artwork.',
      error: error.message,
    });
  }
};

const ensureFeaturedLimit = async ({ id, featured, existingArtwork } = {}) => {
  if (featured !== true) {
    return null;
  }

  const featuredQuery = { featured: true };
  if (id && existingArtwork && existingArtwork._id && String(existingArtwork._id) === String(id)) {
    featuredQuery._id = { $ne: id };
  }

  const featuredCount = await Artwork.countDocuments(featuredQuery);
  if (featuredCount >= FEATURED_LIMIT) {
    return FEATURED_LIMIT_MESSAGE;
  }

  return null;
};

const createArtwork = async (req, res) => {
  try {
    const payload = buildArtworkPayload(req.body);

    if (!payload.title || !payload.title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Artwork title is required.',
      });
    }

    const rawImageValue = payload.imageUrl ?? payload.image;

    if (!rawImageValue || !String(rawImageValue).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Artwork imageUrl is required.',
      });
    }

    const featuredLimitError = await ensureFeaturedLimit({ featured: Boolean(payload.featured) });
    if (featuredLimitError) {
      return res.status(400).json({
        success: false,
        message: featuredLimitError,
      });
    }

    const imageSync = await syncArtworkImage(null, rawImageValue, false);
    const lastArtwork = await Artwork.findOne({}).sort({ order: -1, sortOrder: -1, createdAt: -1 }).lean();
    const nextOrder = lastArtwork ? Number(lastArtwork.order ?? lastArtwork.sortOrder ?? 0) + 1 : 0;

    const artwork = await Artwork.create({
      ...payload,
      ...imageSync,
      imageUrl: imageSync.imageUrl,
      image: imageSync.image || imageSync.imageUrl,
      order: payload.order ?? nextOrder,
      sortOrder: payload.sortOrder ?? nextOrder,
    });

    return res.status(201).json({
      success: true,
      message: 'Artwork created successfully.',
      data: artwork,
    });
  } catch (error) {
    const message = error.message || 'Failed to create artwork.';
    const status = /required|must be|cannot be|empty|boolean|string/i.test(message) ? 400 : 500;

    return res.status(status).json({
      success: false,
      message,
    });
  }
};

const updateArtwork = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid artwork ID.',
    });
  }

  try {
    const artwork = await Artwork.findById(id);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        message: 'Artwork not found.',
      });
    }

    const payload = buildArtworkPayload(req.body);

    if (payload.title !== undefined && !String(payload.title).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Artwork title cannot be empty.',
      });
    }

    if (payload.imageUrl !== undefined && !String(payload.imageUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Artwork imageUrl cannot be empty.',
      });
    }

    const nextFeaturedValue = payload.featured !== undefined ? Boolean(payload.featured) : artwork.featured;
    const featuredLimitError = await ensureFeaturedLimit({
      id,
      featured: nextFeaturedValue,
      existingArtwork: artwork,
    });

    if (featuredLimitError) {
      return res.status(400).json({
        success: false,
        message: featuredLimitError,
      });
    }

    const nextImageValue = payload.imageUrl !== undefined ? payload.imageUrl : payload.image;
    const imageSync = nextImageValue !== undefined ? await syncArtworkImage(artwork, nextImageValue, true) : null;

    if (imageSync) {
      payload.imageUrl = imageSync.imageUrl;
      payload.image = imageSync.image || imageSync.imageUrl;
      payload.cloudinaryPublicId = imageSync.cloudinaryPublicId ?? artwork.cloudinaryPublicId ?? null;
    }

    Object.assign(artwork, payload);
    const updatedArtwork = await artwork.save();

    return res.status(200).json({
      success: true,
      message: 'Artwork updated successfully.',
      data: updatedArtwork,
    });
  } catch (error) {
    const message = error.message || 'Failed to update artwork.';
    const status = /required|must be|cannot be|empty|boolean|string/i.test(message) ? 400 : 500;

    return res.status(status).json({
      success: false,
      message,
    });
  }
};

const replaceArtworkImage = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid artwork ID.',
    });
  }

  try {
    const artwork = await Artwork.findById(id);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        message: 'Artwork not found.',
      });
    }

    const incomingValue = req.body?.image ?? req.body?.imageUrl ?? req.body?.url ?? req.file;

    if (incomingValue === undefined || incomingValue === null || (typeof incomingValue === 'string' && !incomingValue.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A new artwork image is required.',
      });
    }

    const imageSync = await syncArtworkImage(artwork, incomingValue, true);
    artwork.imageUrl = imageSync.imageUrl;
    artwork.image = imageSync.image || imageSync.imageUrl;
    artwork.cloudinaryPublicId = imageSync.cloudinaryPublicId ?? artwork.cloudinaryPublicId ?? null;

    const updatedArtwork = await artwork.save();

    return res.status(200).json({
      success: true,
      message: 'Artwork image replaced successfully.',
      data: updatedArtwork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to replace artwork image.',
      error: error.message,
    });
  }
};

const setFeaturedStatus = async (req, res, featuredValue) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid artwork ID.',
    });
  }

  try {
    const artwork = await Artwork.findById(id);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        message: 'Artwork not found.',
      });
    }

    const nextFeaturedValue = Boolean(featuredValue);
    const featuredLimitError = await ensureFeaturedLimit({
      id,
      featured: nextFeaturedValue,
      existingArtwork: artwork,
    });

    if (featuredLimitError && nextFeaturedValue) {
      return res.status(400).json({
        success: false,
        message: featuredLimitError,
      });
    }

    artwork.featured = nextFeaturedValue;
    const updatedArtwork = await artwork.save();

    return res.status(200).json({
      success: true,
      message: featuredValue ? 'Artwork marked as featured.' : 'Artwork removed from featured works.',
      data: updatedArtwork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update artwork featured status.',
      error: error.message,
    });
  }
};

const featureArtwork = async (req, res) => {
  const requestedValue = req.body && Object.prototype.hasOwnProperty.call(req.body, 'featured') ? req.body.featured : true;
  return setFeaturedStatus(req, res, requestedValue);
};

const unfeatureArtwork = async (req, res) => {
  return setFeaturedStatus(req, res, false);
};

const toggleFeaturedArtwork = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid artwork ID.',
    });
  }

  try {
    const artwork = await Artwork.findById(id);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        message: 'Artwork not found.',
      });
    }

    if (!artwork.featured) {
      const featuredLimitError = await ensureFeaturedLimit({
        id,
        featured: true,
        existingArtwork: artwork,
      });

      if (featuredLimitError) {
        return res.status(400).json({
          success: false,
          message: featuredLimitError,
        });
      }
    }

    artwork.featured = !artwork.featured;
    const updatedArtwork = await artwork.save();

    return res.status(200).json({
      success: true,
      message: updatedArtwork.featured ? 'Artwork marked as featured.' : 'Artwork removed from featured works.',
      data: updatedArtwork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle artwork featured status.',
      error: error.message,
    });
  }
};

const deleteArtwork = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid artwork ID.',
    });
  }

  try {
    const artwork = await Artwork.findById(id);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        message: 'Artwork not found.',
      });
    }

    const publicId = artwork.cloudinaryPublicId;
    let cloudinaryResult = null;

    if (publicId) {
      cloudinaryResult = await safeDeleteArtworkImage(publicId);
    }

    await Artwork.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Artwork deleted successfully.',
      data: {
        id,
        cloudinaryDeleted: publicId ? !!(cloudinaryResult && cloudinaryResult.success) : null,
        cloudinaryPublicId: publicId || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete artwork.',
      error: error.message,
    });
  }
};

module.exports = {
  getArtworks,
  getArtworkById,
  createArtwork,
  updateArtwork,
  replaceArtworkImage,
  featureArtwork,
  unfeatureArtwork,
  toggleFeaturedArtwork,
  deleteArtwork,
  getFeaturedLimitError,
};

const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const { deleteArtworkImage } = require('../services/cloudinaryService');

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
];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

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

  return payload;
};

const getArtworks = async (req, res) => {
  try {
    const artworks = await Artwork.find({}).sort({ createdAt: -1, _id: -1 }).lean();

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

const createArtwork = async (req, res) => {
  try {
    const payload = buildArtworkPayload(req.body);

    if (!payload.title || !payload.title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Artwork title is required.',
      });
    }

    if (!payload.imageUrl || !payload.imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Artwork imageUrl is required.',
      });
    }

    const artwork = await Artwork.create({
      ...payload,
      imageUrl: payload.imageUrl.trim(),
      image: payload.image || payload.imageUrl.trim(),
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

    if (payload.imageUrl) {
      payload.image = payload.image || payload.imageUrl;
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
      try {
        cloudinaryResult = await deleteArtworkImage(publicId);
      } catch (error) {
        cloudinaryResult = {
          success: false,
          error: error.message,
        };
      }
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
  deleteArtwork,
};

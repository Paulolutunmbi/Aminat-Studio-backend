const express = require('express');
const {
  getArtworks,
  getArtworkById,
  createArtwork,
  updateArtwork,
  replaceArtworkImage,
  featureArtwork,
  unfeatureArtwork,
  toggleFeaturedArtwork,
  deleteArtwork,
} = require('../controllers/artworkController');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.get('/', getArtworks);
router.get('/:id', getArtworkById);
router.post('/upload', requireAdminAuth, createArtwork);
router.post('/', requireAdminAuth, createArtwork);
router.put('/:id', requireAdminAuth, updateArtwork);
router.put('/:id/image', requireAdminAuth, replaceArtworkImage);
router.put('/:id/replace-image', requireAdminAuth, replaceArtworkImage);
router.post('/:id/image', requireAdminAuth, replaceArtworkImage);
router.post('/:id/replace-image', requireAdminAuth, replaceArtworkImage);
router.patch('/:id/featured', requireAdminAuth, featureArtwork);
router.patch('/:id/feature', requireAdminAuth, featureArtwork);
router.patch('/:id/unfeature', requireAdminAuth, unfeatureArtwork);
router.patch('/:id/toggle-featured', requireAdminAuth, toggleFeaturedArtwork);
router.patch('/:id', requireAdminAuth, toggleFeaturedArtwork);
router.put('/:id/featured', requireAdminAuth, featureArtwork);
router.put('/:id/unfeature', requireAdminAuth, unfeatureArtwork);
router.delete('/:id', requireAdminAuth, deleteArtwork);

module.exports = router;

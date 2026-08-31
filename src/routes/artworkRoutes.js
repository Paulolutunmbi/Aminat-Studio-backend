const express = require('express');
const {
  getArtworks,
  getArtworkById,
  createArtwork,
  updateArtwork,
  deleteArtwork,
} = require('../controllers/artworkController');

const router = express.Router();

router.get('/', getArtworks);
router.get('/:id', getArtworkById);
router.post('/', createArtwork);
router.put('/:id', updateArtwork);
router.delete('/:id', deleteArtwork);

module.exports = router;

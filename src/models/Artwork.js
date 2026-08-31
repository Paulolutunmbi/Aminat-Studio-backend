const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Artwork title is required.'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    medium: {
      type: String,
      trim: true,
      default: '',
    },
    year: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    imageUrl: {
      type: String,
      required: [true, 'Artwork imageUrl is required.'],
      trim: true,
    },
    image: {
      type: String,
      trim: true,
      default: null,
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: null,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    dimensions: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

artworkSchema.pre('save', function normalizeArtwork(next) {
  if (this.title && typeof this.title === 'string') {
    this.title = this.title.trim();
  }

  if (this.imageUrl && typeof this.imageUrl === 'string') {
    this.imageUrl = this.imageUrl.trim();
  }

  if (this.image && typeof this.image === 'string') {
    this.image = this.image.trim();
  }

  if (!this.image && this.imageUrl) {
    this.image = this.imageUrl;
  }

  if (!this.imageUrl && this.image) {
    this.imageUrl = this.image;
  }

  if (typeof this.featured !== 'boolean') {
    this.featured = Boolean(this.featured);
  }

  next();
});

module.exports = mongoose.model('Artwork', artworkSchema);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Artwork = require('../models/Artwork');
const { uploadArtworkImage } = require('../services/cloudinaryService');

const frontendArtDir = path.resolve(__dirname, '../../../Aminat-Studio-Frontend/public/images/artwork');

const sourceArtworks = [
  {
    title: 'Floral Abstraction',
    description:
      'An exploration of organic forms, vibrant botanical motifs, and imaginative floral silhouettes against a textured warm background.',
    medium: 'Acrylic on Canvas',
    year: '2023',
    imageUrl: '/images/artwork/floral-abstraction.jpg',
    featured: true,
    category: 'Acrylic',
    dimensions: '16 x 20 in',
    createdAt: '2023-11-15T00:00:00.000Z',
  },
  {
    title: 'The Path',
    description:
      'A quiet study of an arched woodland canopy creating a tunnel of green foliage above a winding road with delicate dappled light.',
    medium: 'Watercolor',
    year: '2023',
    imageUrl: '/images/artwork/the-path.jpg',
    featured: true,
    category: 'Watercolour',
    dimensions: '11 x 14 in',
    createdAt: '2023-08-20T00:00:00.000Z',
  },
  {
    title: 'Surreal Landscape',
    description:
      'An imaginative composition featuring a sweeping curved path flanked by a prominent tree canopy, open grassy hill, and wildflower textures.',
    medium: 'Mixed Media',
    year: '2024',
    imageUrl: '/images/artwork/surreal-landscape.jpg',
    featured: true,
    category: 'Mixed Media',
    dimensions: '18 x 24 in',
    createdAt: '2024-02-10T00:00:00.000Z',
  },
  {
    title: "The Artist's Journey",
    description:
      'A reflective profile silhouette where the human contour is mapped into a mountain landscape, flowing water, and emerging blossom.',
    medium: 'Pen & Watercolour',
    year: '2024',
    imageUrl: '/images/artwork/artists-journey.jpg',
    featured: false,
    category: 'Pen',
    dimensions: '12 x 16 in',
    createdAt: '2024-04-18T00:00:00.000Z',
  },
  {
    title: 'Paint With Me - Studio Study',
    description:
      'A personal studio notebook painting capturing a warm horizon over green grass, recorded during a live watercolor painting session.',
    medium: 'Watercolour',
    year: '2024',
    imageUrl: '/images/artwork/paint-with-me.jpg',
    featured: false,
    category: 'Watercolour',
    dimensions: '8 x 10 in',
    createdAt: '2024-06-02T00:00:00.000Z',
  },
];

const isApprovedForExecution = () => {
  const args = new Set((process.argv || []).map((arg) => String(arg).trim().toLowerCase()));
  return args.has('--execute') || args.has('--approve') || args.has('--run');
};

const buildLocalFilePath = (relativeFilePath) => {
  const fileName = relativeFilePath.replace(/^\/images\/artwork\//, '');
  return path.join(frontendArtDir, fileName);
};

const normalizeArtworkRecord = async (artwork) => {
  const localFilePath = buildLocalFilePath(artwork.imageUrl);
  const fileExists = fs.existsSync(localFilePath);

  const baseRecord = {
    title: artwork.title,
    description: artwork.description || '',
    medium: artwork.medium || '',
    year: artwork.year || null,
    imageUrl: artwork.imageUrl,
    image: artwork.imageUrl,
    featured: Boolean(artwork.featured),
    category: artwork.category || '',
    dimensions: artwork.dimensions || '',
    createdAt: new Date(artwork.createdAt || Date.now()),
    updatedAt: new Date(artwork.createdAt || Date.now()),
  };

  if (!process.env.CLOUDINARY_URL) {
    return baseRecord;
  }

  if (!fileExists) {
    console.warn(`Skipping Cloudinary sync for ${artwork.title}: local file not found at ${localFilePath}`);
    return baseRecord;
  }

  try {
    const result = await uploadArtworkImage(localFilePath);
    return {
      ...baseRecord,
      imageUrl: result.secureUrl,
      image: result.secureUrl,
      cloudinaryPublicId: result.publicId,
    };
  } catch (error) {
    console.warn(`Cloudinary upload failed for ${artwork.title}: ${error.message}`);
    return baseRecord;
  }
};

const migrateFrontendArtworks = async () => {
  if (!isApprovedForExecution()) {
    console.log('Migration is disabled by default as a safety measure.');
    console.log('To approve and execute this migration, run:');
    console.log('npm run migrate:artworks -- --execute');
    console.log('This script will migrate the five frontend artworks into MongoDB and optionally sync them to Cloudinary.');
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined.');
  }

  try {
    await connectDB();

    const records = [];
    for (const artwork of sourceArtworks) {
      const normalized = await normalizeArtworkRecord(artwork);
      records.push(normalized);
    }

    const bulkOps = records.map((record) => ({
      updateOne: {
        filter: { title: record.title },
        update: {
          $set: { ...record },
          $setOnInsert: { createdAt: record.createdAt },
        },
        upsert: true,
      },
    }));

    const result = await Artwork.bulkWrite(bulkOps);
    const total = await Artwork.countDocuments();

    console.log('Migration completed.');
    console.log(`Upserted: ${result.upsertedCount || 0}`);
    console.log(`Modified: ${result.modifiedCount || 0}`);
    console.log(`Total artwork documents: ${total}`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

migrateFrontendArtworks();

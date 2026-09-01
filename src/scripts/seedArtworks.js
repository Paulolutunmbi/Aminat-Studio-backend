const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Artwork = require('../models/Artwork');
const { uploadArtworkImage } = require('../services/cloudinaryService');

const frontendArtDir = path.resolve(__dirname, '../../../Aminat-Studio-Frontend/public/images/artwork');

const seedArtworks = [
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

const buildLocalFilePath = (relativeFilePath) => {
  const fileName = relativeFilePath.replace(/^\/images\/artwork\//, '');
  return path.join(frontendArtDir, fileName);
};

const seedExistingArtworks = async () => {
  try {
    await connectDB();

    const shouldUploadToCloudinary = Boolean(process.env.CLOUDINARY_URL && process.env.SEED_ARTWORKS_UPLOAD === 'true');

    const records = [];

    for (const item of seedArtworks) {
      const localFilePath = buildLocalFilePath(item.imageUrl);
      const fileExists = require('fs').existsSync(localFilePath);

      let document = {
        ...item,
        image: item.imageUrl,
      };

      if (shouldUploadToCloudinary && fileExists) {
        try {
          const result = await uploadArtworkImage(localFilePath);
          document = {
            ...document,
            imageUrl: result.secureUrl,
            image: result.secureUrl,
            cloudinaryPublicId: result.publicId,
          };
          console.log(`Uploaded ${item.title} to Cloudinary.`);
        } catch (error) {
          console.warn(`Cloudinary upload skipped for ${item.title}: ${error.message}`);
        }
      } else if (shouldUploadToCloudinary) {
        console.warn(`Skipping Cloudinary upload for ${item.title}: local file not found at ${localFilePath}`);
      } else {
        console.log(`Using frontend asset path for ${item.title}.`);
      }

      records.push({
        ...document,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.createdAt),
      });
    }

    const result = await Artwork.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: { title: record.title },
          update: { $setOnInsert: record },
          upsert: true,
          timestamps: false,
        },
      }))
    );
    const total = await Artwork.countDocuments();
    console.log(`Artwork seed complete: ${result.upsertedCount} inserted, ${records.length - result.upsertedCount} already present, ${total} total records.`);
  } catch (error) {
    console.error('Artwork seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedExistingArtworks();

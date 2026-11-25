import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { AppError } from './error.js';

// Memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const isAllowed = allowedTypes.test(file.mimetype);
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed (JPEG, PNG, WebP, GIF)', 400), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadToCloudinary = async (fileBuffer, folder = 'merobazaar', options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `merobazaar/${folder}`,
        resource_type: 'image',
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  return cloudinary.uploader.destroy(publicId);
};

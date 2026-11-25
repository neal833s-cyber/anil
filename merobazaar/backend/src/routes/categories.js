import { Router } from 'express';
import Category from '../models/Category.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { upload, uploadToCloudinary, deleteFromCloudinary } from '../middleware/upload.js';

const router = Router();

router.get('/', async (req, res) => {
  const categories = await Category.find({ isActive: true, parent: null })
    .sort('sortOrder name')
    .populate('subCategories', 'name slug icon');
  res.json({ success: true, data: categories });
});

router.get('/:id', async (req, res, next) => {
  const cat = await Category.findById(req.params.id).populate('subCategories');
  if (!cat) return next(new AppError('Category not found.', 404));
  res.json({ success: true, data: cat });
});

router.post('/', protect, authorize('admin'), upload.single('image'), async (req, res) => {
  const body = { ...req.body };

  // Upload image to Cloudinary if provided
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'categories');
    body.image = result.url;
    body.imagePublicId = result.public_id;
  }

  const cat = await Category.create(body);
  res.status(201).json({ success: true, data: cat });
});

router.put('/:id', protect, authorize('admin'), upload.single('image'), async (req, res, next) => {
  const existing = await Category.findById(req.params.id);
  if (!existing) return next(new AppError('Category not found.', 404));

  const body = { ...req.body };

  if (req.file) {
    // Delete old image from Cloudinary
    if (existing.imagePublicId) {
      await deleteFromCloudinary(existing.imagePublicId).catch(() => {});
    }
    const result = await uploadToCloudinary(req.file.buffer, 'categories');
    body.image = result.url;
    body.imagePublicId = result.public_id;
  }

  const cat = await Category.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  res.json({ success: true, data: cat });
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) return next(new AppError('Category not found.', 404));

  // Clean up Cloudinary image
  if (cat.imagePublicId) {
    await deleteFromCloudinary(cat.imagePublicId).catch(() => {});
  }

  await cat.deleteOne();
  res.json({ success: true, message: 'Category deleted.' });
});

export default router;

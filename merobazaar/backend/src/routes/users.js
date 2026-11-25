import { Router } from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { upload, uploadToCloudinary } from '../middleware/upload.js';
import { AppError } from '../middleware/error.js';

const router = Router();

router.use(protect);

// Get profile
router.get('/profile', async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: user });
});

// Update profile
router.put('/profile', upload.single('avatar'), async (req, res) => {
  const updates = { name: req.body.name, phone: req.body.phone };

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'avatars');
    updates.avatar = result.url;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, data: user });
});

// Addresses
router.get('/addresses', async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses');
  res.json({ success: true, data: user.addresses });
});

router.post('/addresses', async (req, res) => {
  const user = await User.findById(req.user._id);

  if (req.body.isDefault) {
    user.addresses.forEach((addr) => { addr.isDefault = false; });
  }

  user.addresses.push(req.body);
  await user.save({ validateBeforeSave: false });
  res.status(201).json({ success: true, data: user.addresses });
});

router.put('/addresses/:addressId', async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const addr = user.addresses.id(req.params.addressId);
  if (!addr) return next(new AppError('Address not found.', 404));

  if (req.body.isDefault) {
    user.addresses.forEach((a) => { a.isDefault = false; });
  }

  Object.assign(addr, req.body);
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, data: user.addresses });
});

router.delete('/addresses/:addressId', async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const addr = user.addresses.id(req.params.addressId);
  if (!addr) return next(new AppError('Address not found.', 404));
  addr.deleteOne();
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, data: user.addresses });
});

// Notification preferences
router.put('/notifications/preferences', async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { notificationPreferences: req.body },
    { new: true }
  );
  res.json({ success: true, data: user.notificationPreferences });
});

// Public: get seller store by userId
router.get('/store/:userId', async (req, res, next) => {
  const user = await User.findOne({ _id: req.params.userId, role: 'seller' }).select('name store avatar createdAt');
  if (!user) return next(new AppError('Seller not found.', 404));
  res.json({ success: true, data: user });
});

export default router;

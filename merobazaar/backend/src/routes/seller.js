import { Router } from 'express';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload, uploadToCloudinary } from '../middleware/upload.js';
import { AppError } from '../middleware/error.js';

const router = Router();

router.use(protect, authorize('seller', 'admin'));

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  const [
    totalProducts,
    totalOrders,
    revenueResult,
    recentOrders,
    lowStockProducts,
  ] = await Promise.all([
    Product.countDocuments({ seller: req.user._id, isActive: true }),
    Order.countDocuments({ 'items.seller': req.user._id }),
    Order.aggregate([
      { $match: { 'items.seller': req.user._id } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    Order.find({ 'items.seller': req.user._id })
      .sort('-createdAt')
      .limit(5)
      .populate('buyer', 'name email'),
    Product.find({ seller: req.user._id, stock: { $lte: 5 }, isActive: true })
      .select('name stock images'),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        totalProducts,
        totalOrders,
        totalRevenue: revenueResult[0]?.total || 0,
      },
      recentOrders,
      lowStockProducts,
    },
  });
});

// Seller's own products
router.get('/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const [products, total] = await Promise.all([
    Product.find({ seller: req.user._id })
      .populate('category', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments({ seller: req.user._id }),
  ]);
  res.json({ success: true, data: products, total, page, pages: Math.ceil(total / limit) });
});

// Update inventory
router.put('/products/:id/inventory', async (req, res, next) => {
  const product = await Product.findOne({ _id: req.params.id, seller: req.user._id });
  if (!product) return next(new AppError('Product not found.', 404));
  product.stock = req.body.stock;
  await product.save();
  res.json({ success: true, data: product });
});

// Seller orders
router.get('/orders', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const query = { 'items.seller': req.user._id };
  if (req.query.status) query.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('buyer', 'name email phone'),
    Order.countDocuments(query),
  ]);

  res.json({ success: true, data: orders, total, page, pages: Math.ceil(total / limit) });
});

// Update store profile
router.put('/store', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
  const updates = { ...req.body };

  if (req.files?.logo) {
    const result = await uploadToCloudinary(req.files.logo[0].buffer, 'stores');
    updates['store.logo'] = result.url;
  }
  if (req.files?.banner) {
    const result = await uploadToCloudinary(req.files.banner[0].buffer, 'stores');
    updates['store.banner'] = result.url;
  }

  // Map flat store fields
  Object.keys(updates).forEach((key) => {
    if (!key.startsWith('store.')) {
      updates[`store.${key}`] = updates[key];
      delete updates[key];
    }
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json({ success: true, data: user.store });
});

export default router;

import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import Review from '../models/Review.js';
import { AppError } from '../middleware/error.js';

// @route GET /api/admin/dashboard
export const getDashboardStats = async (req, res) => {
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    revenueResult,
    recentOrders,
    topProducts,
    usersByRole,
    ordersByStatus,
    revenueByMonth,
  ] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
    Order.find().sort('-createdAt').limit(5).populate('buyer', 'name email'),
    Product.find({ isActive: true }).sort('-soldCount').limit(5).select('name images soldCount ratings price'),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalPrice' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: revenueResult[0]?.total || 0,
      },
      recentOrders,
      topProducts,
      usersByRole,
      ordersByStatus,
      revenueByMonth,
    },
  });
};

// @route GET /api/admin/users
export const getUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const query = {};
  if (req.query.role) query.role = req.query.role;
  if (req.query.q) query.$or = [
    { name: new RegExp(req.query.q, 'i') },
    { email: new RegExp(req.query.q, 'i') },
  ];

  const [users, total] = await Promise.all([
    User.find(query).sort('-createdAt').skip((page - 1) * limit).limit(limit),
    User.countDocuments(query),
  ]);

  res.json({ success: true, data: users, total, page, pages: Math.ceil(total / limit) });
};

// @route PUT /api/admin/users/:id
export const updateUser = async (req, res, next) => {
  const { isActive, role } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive, role },
    { new: true, runValidators: true }
  );
  if (!user) return next(new AppError('User not found.', 404));
  res.json({ success: true, data: user });
};

// @route GET /api/admin/orders
export const getAllOrders = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const query = {};
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
};

// @route GET /api/admin/products
export const getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;

  const [products, total] = await Promise.all([
    Product.find()
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name')
      .populate('seller', 'name email'),
    Product.countDocuments(),
  ]);

  res.json({ success: true, data: products, total, page, pages: Math.ceil(total / limit) });
};

// @route DELETE /api/admin/products/:id
export const adminDeleteProduct = async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return next(new AppError('Product not found.', 404));
  res.json({ success: true, message: 'Product deleted.' });
};

// @route GET /api/admin/reviews
export const getAllReviews = async (req, res) => {
  const reviews = await Review.find()
    .populate('user', 'name')
    .populate('product', 'name')
    .sort('-createdAt')
    .limit(50);
  res.json({ success: true, data: reviews });
};

// @route PUT /api/admin/reviews/:id/approve
export const approveReview = async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { isApproved: req.body.isApproved },
    { new: true }
  );
  if (!review) return next(new AppError('Review not found.', 404));
  res.json({ success: true, data: review });
};

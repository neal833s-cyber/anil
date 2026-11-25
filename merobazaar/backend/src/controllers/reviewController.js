import Review from '../models/Review.js';
import Order from '../models/Order.js';
import { AppError } from '../middleware/error.js';

// @route GET /api/reviews/:productId
export const getProductReviews = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  const [reviews, total] = await Promise.all([
    Review.find({ product: req.params.productId, isApproved: true })
      .populate('user', 'name avatar')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments({ product: req.params.productId, isApproved: true }),
  ]);

  // Rating distribution
  const distribution = await Review.aggregate([
    { $match: { product: req.params.productId, isApproved: true } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  res.json({
    success: true,
    data: reviews,
    total,
    page,
    pages: Math.ceil(total / limit),
    distribution,
  });
};

// @route POST /api/reviews/:productId
export const createReview = async (req, res, next) => {
  req.body.product = req.params.productId;
  req.body.user = req.user._id;

  // Check if already reviewed
  const existing = await Review.findOne({ product: req.params.productId, user: req.user._id });
  if (existing) return next(new AppError('You have already reviewed this product.', 400));

  // Check for verified purchase
  const purchasedOrder = await Order.findOne({
    buyer: req.user._id,
    'items.product': req.params.productId,
    status: 'delivered',
  });
  req.body.isVerifiedPurchase = !!purchasedOrder;

  const review = await Review.create(req.body);
  await review.populate('user', 'name avatar');

  res.status(201).json({ success: true, data: review });
};

// @route PUT /api/reviews/:id
export const updateReview = async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError('Review not found.', 404));

  if (review.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized.', 403));
  }

  const updated = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('user', 'name avatar');

  res.json({ success: true, data: updated });
};

// @route DELETE /api/reviews/:id
export const deleteReview = async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError('Review not found.', 404));

  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Not authorized.', 403));
  }

  await review.deleteOne();
  res.json({ success: true, message: 'Review deleted.' });
};

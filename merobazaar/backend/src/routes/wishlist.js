import { Router } from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const router = Router();

router.use(protect);

router.get('/', async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    match: { isActive: true },
    select: 'name images price salePrice ratings numReviews',
  });
  res.json({ success: true, data: user.wishlist });
});

router.post('/toggle/:productId', async (req, res, next) => {
  const product = await Product.findById(req.params.productId);
  if (!product) return next(new AppError('Product not found.', 404));

  const user = await User.findById(req.user._id);
  const isWishlisted = user.wishlist.includes(req.params.productId);

  if (isWishlisted) {
    user.wishlist.pull(req.params.productId);
    await Product.findByIdAndUpdate(req.params.productId, { $inc: { wishlistCount: -1 } });
  } else {
    user.wishlist.push(req.params.productId);
    await Product.findByIdAndUpdate(req.params.productId, { $inc: { wishlistCount: 1 } });
  }

  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    isWishlisted: !isWishlisted,
    message: isWishlisted ? 'Removed from wishlist.' : 'Added to wishlist.',
  });
});

export default router;

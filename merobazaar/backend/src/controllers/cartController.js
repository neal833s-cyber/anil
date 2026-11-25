import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { AppError } from '../middleware/error.js';

// @route GET /api/cart
export const getCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate({
    path: 'items.product',
    select: 'name images price salePrice stock isActive seller',
    populate: { path: 'seller', select: 'name' },
  });

  if (!cart) {
    return res.json({ success: true, data: { items: [], subtotal: 0, itemsCount: 0 } });
  }

  // Filter out inactive products
  cart.items = cart.items.filter((item) => item.product?.isActive);

  res.json({ success: true, data: cart });
};

// @route POST /api/cart/add
export const addToCart = async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new AppError('Product not found.', 404));
  }

  if (product.stock < quantity) {
    return next(new AppError('Insufficient stock.', 400));
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      items: [{ product: productId, quantity, price: product.salePrice || product.price }],
    });
  } else {
    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity, price: product.salePrice || product.price });
    }

    await cart.save();
  }

  await cart.populate({ path: 'items.product', select: 'name images price salePrice stock' });

  res.json({ success: true, data: cart, message: 'Added to cart.' });
};

// @route PUT /api/cart/update
export const updateCartItem = async (req, res, next) => {
  const { productId, quantity } = req.body;

  if (quantity < 1) return next(new AppError('Quantity must be at least 1.', 400));

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError('Cart not found.', 404));

  const item = cart.items.find((i) => i.product.toString() === productId);
  if (!item) return next(new AppError('Item not in cart.', 404));

  const product = await Product.findById(productId);
  if (product.stock < quantity) return next(new AppError('Insufficient stock.', 400));

  item.quantity = quantity;
  await cart.save();

  res.json({ success: true, data: cart });
};

// @route DELETE /api/cart/remove/:productId
export const removeFromCart = async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError('Cart not found.', 404));

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== req.params.productId
  );

  await cart.save();
  res.json({ success: true, data: cart, message: 'Item removed.' });
};

// @route DELETE /api/cart/clear
export const clearCart = async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], discount: 0, couponCode: '' });
  res.json({ success: true, message: 'Cart cleared.' });
};

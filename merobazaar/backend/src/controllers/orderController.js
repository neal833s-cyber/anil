import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import Notification from '../models/Notification.js';
import { AppError } from '../middleware/error.js';
import { sendOrderConfirmationEmail } from '../utils/email.js';

// @route POST /api/orders
export const createOrder = async (req, res, next) => {
  const { items, shippingAddress, paymentMethod, notes, couponCode } = req.body;

  // Validate products and calculate prices
  const orderItems = [];
  let itemsPrice = 0;

  for (const item of items) {
    const product = await Product.findById(item.product).populate('seller', '_id');
    if (!product || !product.isActive) {
      return next(new AppError(`Product not found: ${item.product}`, 404));
    }
    if (product.stock < item.quantity) {
      return next(new AppError(`Insufficient stock for: ${product.name}`, 400));
    }

    const price = product.salePrice || product.price;
    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images[0]?.url,
      price,
      quantity: item.quantity,
      seller: product.seller?._id ?? product.seller,
    });
    itemsPrice += price * item.quantity;
  }

  const shippingPrice = itemsPrice >= 2000 ? 0 : 100; // Free shipping over Rs 2000
  const taxPrice = Math.round(itemsPrice * 0.13); // 13% VAT in Nepal
  const totalPrice = itemsPrice + shippingPrice + taxPrice;

  const order = await Order.create({
    buyer: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    notes,
    couponCode,
    trackingHistory: [{ status: 'pending', description: 'Order placed successfully' }],
  });

  // Decrement stock
  for (const item of items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity, soldCount: item.quantity },
    });
  }

  // Clear user's cart
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

  // Send confirmation email
  try {
    await sendOrderConfirmationEmail(req.user.email, order);
  } catch {
    // Non-blocking
  }

  // Create notification
  await Notification.create({
    user: req.user._id,
    type: 'order',
    title: 'Order Placed!',
    message: `Your order #${order.orderNumber} has been placed successfully.`,
    link: `/orders/${order._id}`,
    icon: '🛍️',
  });

  // Emit socket notification
  const io = req.app.get('io');
  io?.to(`user:${req.user._id}`).emit('notification', {
    type: 'order',
    message: `Order #${order.orderNumber} placed!`,
  });

  const populated = await order.populate('items.product', 'name images');

  res.status(201).json({ success: true, data: populated });
};

// @route GET /api/orders
export const getMyOrders = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ buyer: req.user._id })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('items.product', 'name images'),
    Order.countDocuments({ buyer: req.user._id }),
  ]);

  res.json({ success: true, data: orders, total, page, pages: Math.ceil(total / limit) });
};

// @route GET /api/orders/:id
export const getOrder = async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name email phone')
    .populate('items.product', 'name images price');

  if (!order) return next(new AppError('Order not found.', 404));

  // Only buyer or admin can view
  if (order.buyer._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Not authorized.', 403));
  }

  res.json({ success: true, data: order });
};

// @route GET /api/orders/track/:trackingCode
export const trackOrder = async (req, res, next) => {
  const order = await Order.findOne({ trackingCode: req.params.trackingCode })
    .select('orderNumber status trackingHistory shippingAddress paymentMethod totalPrice createdAt');

  if (!order) return next(new AppError('Tracking code not found.', 404));

  res.json({ success: true, data: order });
};

// @route PUT /api/orders/:id/cancel
export const cancelOrder = async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found.', 404));

  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized.', 403));
  }

  if (!['pending', 'confirmed'].includes(order.status)) {
    return next(new AppError('Order cannot be cancelled at this stage.', 400));
  }

  order.status = 'cancelled';
  order.isCancelled = true;
  order.cancelledAt = new Date();
  order.cancelReason = req.body.reason || 'Cancelled by buyer';
  order.trackingHistory.push({ status: 'cancelled', description: req.body.reason || 'Cancelled by buyer' });

  await order.save();

  // Restore stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity, soldCount: -item.quantity },
    });
  }

  res.json({ success: true, data: order });
};

// @route PUT /api/orders/:id/status  (admin/seller)
export const updateOrderStatus = async (req, res, next) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found.', 404));

  order.status = status;
  order.trackingHistory.push({
    status,
    description: req.body.description || `Status updated to ${status}`,
    location: req.body.location,
  });

  if (status === 'delivered') {
    order.isDelivered = true;
    order.deliveredAt = new Date();
    order.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
  }

  await order.save();

  // Notify buyer
  await Notification.create({
    user: order.buyer,
    type: 'shipping',
    title: 'Order Update',
    message: `Your order #${order.orderNumber} is now ${status}.`,
    link: `/orders/${order._id}`,
  });

  const io = req.app.get('io');
  io?.to(`user:${order.buyer}`).emit('order:update', { orderId: order._id, status });

  res.json({ success: true, data: order });
};

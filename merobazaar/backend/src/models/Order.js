import mongoose from 'mongoose';
import crypto from 'crypto';

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String },
  country: { type: String, default: 'Nepal' },
});

const trackingSchema = new mongoose.Schema({
  status: { type: String, required: true },
  description: { type: String },
  location: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    shippingAddress: shippingAddressSchema,
    paymentMethod: {
      type: String,
      enum: ['cod', 'esewa', 'khalti', 'stripe'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentDetails: {
      transactionId: String,
      pidx: String,
      refundId: String,
      paidAt: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'pending',
    },
    trackingHistory: [trackingSchema],
    trackingCode: { type: String },
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, default: 0 },
    taxPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String },
    notes: { type: String },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

// Generate order number and tracking code
orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber = 'MB-' + Date.now().toString().slice(-8).toUpperCase();
  }
  if (!this.trackingCode) {
    this.trackingCode = 'TRK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

// Indexes
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ trackingCode: 1 });

export default mongoose.model('Order', orderSchema);

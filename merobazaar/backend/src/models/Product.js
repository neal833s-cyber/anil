import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String },
  alt: { type: String },
});

const specSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
});

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Color", "Size"
  options: [{ value: String, price: Number, stock: Number, sku: String }],
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: [200, 'Name too long'] },
    slug: { type: String, unique: true, lowercase: true },
    description: { type: String, required: [true, 'Description required'], maxlength: 5000 },
    shortDescription: { type: String, maxlength: 300 },
    price: { type: Number, required: [true, 'Price required'], min: 0 },
    salePrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'NPR' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    brand: { type: String, trim: true },
    images: { type: [imageSchema], validate: [(arr) => arr.length > 0, 'At least one image required'] },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, trim: true },
    weight: { type: Number, min: 0 }, // in grams
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDigital: { type: Boolean, default: false },
    tags: [{ type: String, lowercase: true, trim: true }],
    ratings: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },
    specifications: [specSchema],
    variants: [variantSchema],
    shippingInfo: {
      freeShipping: { type: Boolean, default: false },
      shippingCost: { type: Number, default: 0 },
      estimatedDelivery: { type: String, default: '3-7 business days' },
    },
    returnPolicy: { type: String, default: '7-day return policy' },
    viewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    wishlistCount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual: discount percentage
productSchema.virtual('discountPercent').get(function () {
  if (this.salePrice && this.price > 0) {
    return Math.round(((this.price - this.salePrice) / this.price) * 100);
  }
  return 0;
});

// Virtual: effective price
productSchema.virtual('effectivePrice').get(function () {
  return this.salePrice || this.price;
});

// Auto-generate slug from name
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// Indexes for search performance
productSchema.index({ name: 'text', description: 'text', brand: 'text', tags: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ seller: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, createdAt: -1 });
productSchema.index({ price: 1 });
productSchema.index({ ratings: -1 });

export default mongoose.model('Product', productSchema);

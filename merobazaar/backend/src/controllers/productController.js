import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { APIFeatures } from '../utils/apiFeatures.js';
import { AppError } from '../middleware/error.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../middleware/upload.js';

// @route GET /api/products
export const getProducts = async (req, res) => {
  const features = new APIFeatures(
    Product.find({ isActive: true }).populate('category', 'name slug icon').populate('seller', 'name store'),
    req.query
  )
    .filter()
    .search(['name', 'description', 'brand', 'tags'])
    .sort()
    .limitFields()
    .paginate(12);

  const [products, total] = await Promise.all([
    features.query,
    Product.countDocuments({ isActive: true }),
  ]);

  res.json({
    success: true,
    count: products.length,
    total,
    page: features.page,
    pages: Math.ceil(total / features.limit),
    data: products,
  });
};

// @route GET /api/products/featured
export const getFeaturedProducts = async (req, res) => {
  const products = await Product.find({ isActive: true, isFeatured: true })
    .populate('category', 'name slug')
    .populate('seller', 'name')
    .sort('-createdAt')
    .limit(8);

  res.json({ success: true, data: products });
};

// @route GET /api/products/:id
export const getProduct = async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug icon color')
    .populate('seller', 'name avatar store');

  if (!product || !product.isActive) {
    return next(new AppError('Product not found.', 404));
  }

  // Increment view count
  await Product.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

  res.json({ success: true, data: product });
};

// @route POST /api/products
export const createProduct = async (req, res, next) => {
  req.body.seller = req.user._id;

  // Handle image uploads
  if (req.files?.length) {
    const uploads = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer, 'products'))
    );
    req.body.images = uploads;
  }

  if (!req.body.images?.length) {
    return next(new AppError('At least one product image is required.', 400));
  }

  const product = await Product.create(req.body);
  await Category.findByIdAndUpdate(product.category, { $inc: { productCount: 1 } });

  res.status(201).json({ success: true, data: product });
};

// @route PUT /api/products/:id
export const updateProduct = async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) return next(new AppError('Product not found.', 404));

  // Only seller or admin can update
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to update this product.', 403));
  }

  // Handle new image uploads
  if (req.files?.length) {
    const uploads = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer, 'products'))
    );
    req.body.images = [...(req.body.keepImages ? JSON.parse(req.body.keepImages) : product.images), ...uploads];
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: product });
};

// @route DELETE /api/products/:id
export const deleteProduct = async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found.', 404));

  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Not authorized.', 403));
  }

  // Delete images from Cloudinary
  await Promise.all(
    product.images
      .filter((img) => img.public_id)
      .map((img) => deleteFromCloudinary(img.public_id))
  );

  await product.deleteOne();
  await Category.findByIdAndUpdate(product.category, { $inc: { productCount: -1 } });

  res.json({ success: true, message: 'Product deleted.' });
};

// @route GET /api/products/related/:id
export const getRelatedProducts = async (req, res, next) => {
  const product = await Product.findById(req.params.id).select('category');
  if (!product) return next(new AppError('Product not found.', 404));

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    isActive: true,
  })
    .populate('category', 'name slug')
    .limit(6);

  res.json({ success: true, data: related });
};

// @route GET /api/products/by-seller/:sellerId
export const getSellerProducts = async (req, res) => {
  const features = new APIFeatures(
    Product.find({ seller: req.params.sellerId, isActive: true }),
    req.query
  )
    .sort()
    .paginate(12);

  const products = await features.query;
  res.json({ success: true, data: products });
};

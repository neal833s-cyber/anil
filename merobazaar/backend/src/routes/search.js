import { Router } from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { APIFeatures } from '../utils/apiFeatures.js';

const router = Router();

// Advanced search
router.get('/', async (req, res) => {
  const {
    q, category, minPrice, maxPrice, brand, rating, sort = '-createdAt',
    page = 1, limit = 12, inStock,
  } = req.query;

  const filter = { isActive: true };

  if (q) {
    filter.$text = { $search: q };
  }

  if (category) {
    // If it looks like a valid ObjectId use it directly, otherwise try slug lookup
    const isObjectId = /^[a-f\d]{24}$/i.test(category);
    if (isObjectId) {
      filter.category = category;
    } else {
      const cat = await Category.findOne({ slug: category }).select('_id');
      if (cat) {
        filter.category = cat._id;
      } else {
        // Unknown slug — return empty results instead of crashing
        return res.json({ success: true, data: [], total: 0, page: 1, pages: 0, facets: { brands: [], priceRange: { min: 0, max: 100000 } } });
      }
    }
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (brand) filter.brand = new RegExp(brand, 'i');

  if (rating) filter.ratings = { $gte: Number(rating) };

  if (inStock === 'true') filter.stock = { $gt: 0 };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const sortObj = {};
  if (sort === 'price-asc') sortObj.price = 1;
  else if (sort === 'price-desc') sortObj.price = -1;
  else if (sort === 'rating') sortObj.ratings = -1;
  else if (sort === 'newest') sortObj.createdAt = -1;
  else if (sort === 'popular') sortObj.soldCount = -1;
  else sortObj.createdAt = -1;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate('category', 'name slug icon')
      .populate('seller', 'name'),
    Product.countDocuments(filter),
  ]);

  // Aggregates for facets (filters sidebar)
  const [brands, priceRange] = await Promise.all([
    Product.distinct('brand', { isActive: true, ...(filter.category && { category: filter.category }) }),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]),
  ]);

  res.json({
    success: true,
    data: products,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    facets: {
      brands: brands.filter(Boolean),
      priceRange: priceRange[0] || { min: 0, max: 100000 },
    },
  });
});

// Search suggestions
router.get('/suggestions', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, data: [] });

  const [products, categories] = await Promise.all([
    Product.find({ name: new RegExp(q, 'i'), isActive: true }).select('name').limit(5),
    Category.find({ name: new RegExp(q, 'i'), isActive: true }).select('name slug').limit(3),
  ]);

  res.json({
    success: true,
    data: {
      products,
      categories,
    },
  });
});

export default router;

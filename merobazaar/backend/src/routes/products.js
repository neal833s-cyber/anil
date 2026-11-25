import { Router } from 'express';
import {
  getProducts, getFeaturedProducts, getProduct, createProduct,
  updateProduct, deleteProduct, getRelatedProducts, getSellerProducts,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/by-seller/:sellerId', getSellerProducts);
router.get('/:id', getProduct);
router.get('/:id/related', getRelatedProducts);

router.post('/', protect, authorize('seller', 'admin'), upload.array('images', 10), createProduct);
router.put('/:id', protect, authorize('seller', 'admin'), upload.array('images', 10), updateProduct);
router.delete('/:id', protect, authorize('seller', 'admin'), deleteProduct);

export default router;

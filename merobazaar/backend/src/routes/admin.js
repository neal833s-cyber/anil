import { Router } from 'express';
import { getDashboardStats, getUsers, updateUser, getAllOrders, getAllProducts, adminDeleteProduct, getAllReviews, approveReview } from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.get('/orders', getAllOrders);
router.get('/products', getAllProducts);
router.delete('/products/:id', adminDeleteProduct);
router.get('/reviews', getAllReviews);
router.put('/reviews/:id/approve', approveReview);

export default router;

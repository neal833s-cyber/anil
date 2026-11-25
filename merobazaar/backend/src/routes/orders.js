import { Router } from 'express';
import { createOrder, getMyOrders, getOrder, trackOrder, cancelOrder, updateOrderStatus } from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.get('/track/:trackingCode', trackOrder);

router.use(protect);
router.post('/', validate(schemas.order), createOrder);
router.get('/', getMyOrders);
router.get('/:id', getOrder);
router.put('/:id/cancel', cancelOrder);
router.put('/:id/status', authorize('admin', 'seller'), updateOrderStatus);

export default router;

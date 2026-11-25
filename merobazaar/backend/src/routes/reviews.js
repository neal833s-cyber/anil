import { Router } from 'express';
import { getProductReviews, createReview, updateReview, deleteReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.get('/:productId', getProductReviews);
router.post('/:productId', protect, validate(schemas.review), createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

export default router;

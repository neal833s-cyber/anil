import { Router } from 'express';
import express from 'express';
import { createStripeIntent, stripeWebhook, initiateEsewa, verifyEsewa, initiateKhalti, verifyKhalti } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Stripe webhook needs raw body
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

router.use(protect);
router.post('/stripe/create-intent', createStripeIntent);
router.post('/esewa/initiate', initiateEsewa);
router.get('/esewa/verify', verifyEsewa);
router.post('/khalti/initiate', initiateKhalti);
router.post('/khalti/verify', verifyKhalti);

export default router;

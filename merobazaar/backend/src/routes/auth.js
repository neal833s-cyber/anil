import { Router } from 'express';
import {
  register, verifyOtp, resendOtp, login, refreshToken, logout,
  forgotPassword, resetPassword, getMe, updatePassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.post('/register', validate(schemas.register), register);
router.post('/verify-otp', validate(schemas.verifyOtp), verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', validate(schemas.login), login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', validate(schemas.forgotPassword), forgotPassword);
router.put('/reset-password/:token', validate(schemas.resetPassword), resetPassword);

// Protected
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);

export default router;

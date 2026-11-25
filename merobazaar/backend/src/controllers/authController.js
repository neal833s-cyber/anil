import crypto from 'crypto';
import User from '../models/User.js';
import { sendTokenResponse, verifyRefreshToken, generateAccessToken } from '../utils/jwt.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../utils/email.js';
import { AppError } from '../middleware/error.js';

// @route POST /api/auth/register
export const register = async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return next(new AppError('Email already registered.', 400));
  }

  const user = await User.create({ name, email, password, role: role || 'buyer' });

  // Generate and send OTP
  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });

  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('Failed to send verification email. Please try again.', 500));
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Check your email for the OTP.',
    email,
  });
};

// @route POST /api/auth/verify-otp
export const verifyOtp = async (req, res, next) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email }).select('+otp +otpExpire');
  if (!user) return next(new AppError('User not found.', 404));

  if (!user.verifyOTP(otp)) {
    return next(new AppError('Invalid or expired OTP.', 400));
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpire = undefined;
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
};

// @route POST /api/auth/resend-otp
export const resendOtp = async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return next(new AppError('User not found.', 404));
  if (user.isVerified) return next(new AppError('Account already verified.', 400));

  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });
  await sendOtpEmail(email, otp);

  res.json({ success: true, message: 'OTP resent to your email.' });
};

// @route POST /api/auth/login
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError('Invalid email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been suspended.', 403));
  }

  if (!user.isVerified) {
    return next(new AppError('Please verify your email before logging in.', 403));
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
};

// @route POST /api/auth/refresh-token
export const refreshToken = async (req, res, next) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return next(new AppError('No refresh token.', 401));

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) return next(new AppError('User not found.', 401));

    const accessToken = generateAccessToken(user._id);
    res.json({ success: true, accessToken });
  } catch {
    return next(new AppError('Invalid refresh token.', 401));
  }
};

// @route POST /api/auth/logout
export const logout = async (req, res) => {
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  res.json({ success: true, message: 'Logged out successfully.' });
};

// @route POST /api/auth/forgot-password
export const forgotPassword = async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('No account found with that email.', 404));

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
    res.json({ success: true, message: 'Password reset link sent to your email.' });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('Failed to send reset email. Please try again.', 500));
  }
};

// @route PUT /api/auth/reset-password/:token
export const resetPassword = async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire');

  if (!user) return next(new AppError('Invalid or expired reset token.', 400));

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
};

// @route GET /api/auth/me
export const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: user });
};

// @route PUT /api/auth/update-password
export const updatePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.password = newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
};

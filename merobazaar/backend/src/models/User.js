import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const storeSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  description: { type: String },
  logo: { type: String },
  banner: { type: String },
  address: { type: String },
  phone: { type: String },
  website: { type: String },
  socialLinks: {
    facebook: String,
    instagram: String,
    twitter: String,
  },
  isVerified: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
});

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String },
  country: { type: String, default: 'Nepal' },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: [80, 'Name too long'] },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    phone: { type: String, match: [/^\+?[\d\s-]{7,15}$/, 'Invalid phone number'] },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    addresses: [addressSchema],
    store: storeSchema,
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    // OTP fields
    otp: { type: String, select: false },
    otpExpire: { type: Date, select: false },
    // Password reset
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    // Refresh tokens
    refreshTokens: { type: [String], select: false, default: [] },
    // Notifications
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
    },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = crypto.createHash('sha256').update(otp).digest('hex');
  this.otpExpire = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRE_MINUTES) || 10) * 60 * 1000);
  return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function (otp) {
  const hashed = crypto.createHash('sha256').update(otp).digest('hex');
  return this.otp === hashed && this.otpExpire > Date.now();
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
  return resetToken;
};

// Remove sensitive fields when converting to JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpire;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.refreshTokens;
  return obj;
};

export default mongoose.model('User', userSchema);

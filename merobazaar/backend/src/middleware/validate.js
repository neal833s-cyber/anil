import Joi from 'joi';
import { AppError } from './error.js';

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,          // coerce numbers/booleans from strings
      allowUnknown: false,
    });
    if (error) {
      const messages = error.details.map((d) => d.message).join(', ');
      return next(new AppError(messages, 400));
    }
    // Replace req.body with the validated (and coerced) value
    req[source] = value;
    next();
  };
};

// Validation schemas
export const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
      .messages({ 'string.pattern.base': 'Password must contain uppercase, lowercase, and a digit' }),
    role: Joi.string().valid('buyer', 'seller').default('buyer'),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  verifyOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(80),
    phone: Joi.string().pattern(/^\+?[\d\s-]{7,15}$/),
    avatar: Joi.string().uri(),
  }),

  product: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(5000).required(),
    price: Joi.number().min(0).required(),
    salePrice: Joi.number().min(0),
    category: Joi.string().required(),
    brand: Joi.string().max(100),
    stock: Joi.number().min(0).default(0),
    isFeatured: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string()),
    specifications: Joi.array().items(Joi.object({ key: Joi.string(), value: Joi.string() })),
  }),

  review: Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    title: Joi.string().max(100),
    comment: Joi.string().min(5).max(1000).required(),
  }),

  order: Joi.object({
    items: Joi.array().items(
      Joi.object({
        product: Joi.string().trim().min(1).required(),
        quantity: Joi.number().integer().min(1).required(),
      }).required()
    ).min(1).required(),
    shippingAddress: Joi.object({
      fullName: Joi.string().trim().min(1).required(),
      phone: Joi.string().trim().min(1).required(),
      street: Joi.string().trim().min(1).required(),
      city: Joi.string().trim().min(1).required(),
      state: Joi.string().trim().min(1).required(),
      postalCode: Joi.string().trim().allow('', null).optional(),
      country: Joi.string().trim().default('Nepal'),
    }).required(),
    paymentMethod: Joi.string().valid('cod', 'esewa', 'khalti', 'stripe').required(),
    couponCode: Joi.string().trim().allow('', null).optional(),
    notes: Joi.string().trim().max(500).allow('', null).optional(),
  }),
};

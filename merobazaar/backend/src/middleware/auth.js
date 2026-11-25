import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { AppError } from './error.js';

export const protect = async (req, res, next) => {
  let token;

  // Extract from Bearer header or cookie
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(new AppError('Access denied. Please log in.', 401));
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('+refreshTokens');

    if (!user) {
      return next(new AppError('User not found.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated.', 403));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token.', 401));
  }
};

// Authorize roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Role '${req.user.role}' is not authorized for this action.`, 403));
    }
    next();
  };
};

// Optional auth — attach user if token present, but don't fail
export const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = await User.findById(decoded.id);
    } catch {
      // silent fail
    }
  }
  next();
};

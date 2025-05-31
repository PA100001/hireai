const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const config = require('../config');

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // Verify token
  const decoded = await promisify(jwt.verify)(token, config.jwtSecret);

  // Check if user still exists
  const currentUser = await User.findById(decoded.id).populate('profile'); // Populate profile
  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(Number(req.user.role))) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

exports.isAdmin = (req, res, next) => {
    if (req.user.role !== adminRole) {
        return next(new AppError('Access denied. Admin privileges required.', 403));
    }
    next();
};
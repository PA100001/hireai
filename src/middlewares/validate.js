const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors for better readability
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.param || err.path]: err.msg })); // err.param is for older versions
    return next(new AppError('Validation Error', 400, extractedErrors)); // Pass array of errors
  }
  next();
};

module.exports = validate;
class AppError extends Error {
  constructor(message, statusCode, errorsArray = null) { // Add errorsArray
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    if (errorsArray) { // Attach if provided
      this.errors = errorsArray;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = AppError;
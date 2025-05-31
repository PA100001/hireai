// Utility to wrap async route handlers and catch errors
module.exports = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};
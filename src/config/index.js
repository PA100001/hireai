const dotenv = require('dotenv');
dotenv.config(); // Load .env file
const path = require('path');
const HIRE_AI_SERVICE_ACCOUNT  = path.join(__dirname, ".." ,"..", process.env.HIRE_AI_SERVICE_ACCOUNT);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  gcpServiceAccountKeyFile : HIRE_AI_SERVICE_ACCOUNT,
  gcpBucketName: process.env.GCP_BUCKET_NAME || 'hireai',
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(', ') : [],
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '15', 10) * 60 * 1000, // minutes to ms
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10', 10),
  }
};
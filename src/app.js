const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middlewares/errorMiddleware');
const apiV1Router = require('./routes'); // Main router for /api/v1
const config = require('./config');
const { generalLimiter } = require('./middlewares/rateLimit');
const logger = require('./config/logger');
const { successResponse, errorResponse } = require("./utils/standardApiResponse");

const app = express();

// 1. Global Middlewares
// Set security HTTP headers
app.use(helmet());

// CORS
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsAllowedOrigins.includes(origin) || config.env === 'development') {
      callback(null, true);
    } else {
      callback(new AppError('Not allowed by CORS', 403));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    cors(corsOptions)(req, res, next);
  } else {
    next();
  }
});

// Development logging
if (config.env === 'development') {
  app.use(morgan('dev', { stream: { write: message => logger.info(message.trim()) } }));
} else {
  // More concise logging for production, or customize as needed
  app.use(morgan('short', { stream: { write: message => logger.info(message.trim()) } }));
}


// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // For JSON payloads
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // For form data

// Apply general rate limiting to all API requests
app.use('/api', generalLimiter);


// 2. Routes
app.get('/', (req, res) => successResponse(res, 200, 'Job Platform MVP API Running!')); // Health check
app.use('/api/v1', apiV1Router);

// 3. Handle 404 Not Found
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 4. Global Error Handling Middleware
app.use(globalErrorHandler);

module.exports = app;
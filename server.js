const app = require('./src/app');
const connectDB = require('./src/config/db');
const config = require('./src/config');
const logger = require('./src/config/logger');


// Connect to Database
connectDB();

const server = app.listen(config.port, () => {
  logger.info(`App running on port ${config.port}... in ${config.env} mode.`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal (e.g., from Docker stop)
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.info('💥 Process terminated!');
    process.exit(0);
  });
});
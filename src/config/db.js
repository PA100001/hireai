const mongoose = require('mongoose');
const config = require('./index');
const logger = require('./logger');

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('MongoDB Connected...');
  } catch (err) {
    logger.error(`MongoDB Connection Error: ${err.message}`);
    // process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;
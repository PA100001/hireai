const { Storage } = require('@google-cloud/storage'); // Correct import
const config = require('./index');
const logger = require('./logger');
const BUCKET_NAME = config.gcpBucketName;
let bucketInstance = null;

const connectGCPBucket = async () => {
  if (bucketInstance) {
    logger.debug('Reusing existing GCP Bucket connection.');
    return bucketInstance;
  }

  if (!config.gcpServiceAccountKeyFile) {
    logger.error('GCP Service Account Key File path is not defined in config.');
    // Decide how to handle this: throw error, return null, or exit
    throw new Error('GCP_SERVICE_ACCOUNT_KEY_FILE_PATH_MISSING');
  }
  if (!BUCKET_NAME) {
    logger.error('GCP Bucket Name is not defined in config.');
    throw new Error('GCP_BUCKET_NAME_MISSING');
  }

  try {
    const storage = new Storage({
      keyFilename: config.gcpServiceAccountKeyFile, // Use the correct config key
    });
    bucketInstance = storage.bucket(BUCKET_NAME);

    // Optional: Check if bucket exists or is accessible
    const [exists] = await bucketInstance.exists();
    if (!exists) {
        logger.error(`GCP Bucket "${BUCKET_NAME}" does not exist or is not accessible.`);
        bucketInstance = null; // Reset instance if check fails
        throw new Error(`GCP_BUCKET_NOT_FOUND_OR_NO_ACCESS: ${BUCKET_NAME}`);
    }

    logger.info(`GCP Bucket "${BUCKET_NAME}" Connected...`);
    return bucketInstance;
  } catch (error) { // Corrected variable name
    logger.error(`GCP Bucket Connection Error: ${error.message}`, error);
    bucketInstance = null; // Reset instance on error
    // Re-throw the error so the application knows connection failed
    throw error;
  }
};

// Function to get the bucket instance, ensures connection is attempted if not already connected
const getGCPBucket = async () => {
    if (!bucketInstance) {
        await connectGCPBucket();
    }
    if (!bucketInstance) { // If connectGCPBucket failed and threw, this won't be hit.
                           // But if it returned null/undefined without throwing, this is a safeguard.
        throw new Error("GCP Bucket is not available.");
    }
    return bucketInstance;
};


module.exports = {
    connectGCPBucket, // Export if direct connection initiation is needed elsewhere
    getGCPBucket      // Preferred way to get the bucket instance
};
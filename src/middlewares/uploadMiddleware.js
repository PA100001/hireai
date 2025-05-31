const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromise = require('fs').promises
const AppError = require('../utils/AppError');
const logger = require('../config/logger'); 
const {defaultUploadFolder, resumeFolder, profilePictureFolder} = require('../constants')
// Ensure uploads directory exists
const DEFAULT_BASE_UPLOAD_DIR  = path.join(__dirname, "..", "..", defaultUploadFolder );
if (!fs.existsSync(DEFAULT_BASE_UPLOAD_DIR )) {
  fs.mkdirSync(DEFAULT_BASE_UPLOAD_DIR , { recursive: true });
}

/**
 * Creates a generic Multer upload middleware.
 *
 * @param {object} options - Configuration options for the upload.
 * @param {string} options.fieldName - The name of the field in the form-data that contains the file.
 * @param {string[] | undefined} options.allowedMimeTypes - An array of allowed MIME types (e.g., ['image/jpeg', 'application/pdf']). If undefined, all types are allowed (not recommended for production).
 * @param {number} options.maxFileSize - Maximum file size in bytes.
 * @param {(req, file, cb) => void} options.destination - Multer destination function. cb(error, destinationPath).
 *                                                        Example: (req, file, cb) => cb(null, path.join(DEFAULT_BASE_UPLOAD_DIR, 'images'))
 * @param {(req, file, cb) => void} [options.filename] - Optional Multer filename function. cb(error, filename).
 *                                                       Defaults to a unique name: `user-timestamp-originalname`.
 * @returns {function} Express middleware for handling single file upload.
 */
const createUploadMiddleware = (options) => {
  if (!options || !options.fieldName || !options.allowedMimeTypes || !options.maxFileSize || !options.destination) {
    throw new Error('createUploadMiddleware requires fieldName, allowedMimeTypes, maxFileSize, and destination options.');
  }

  // Default filename generator if not provided
  const defaultFilenameGenerator = (req, file, cb) => {
    const userIdPrefix = req.user && req.user.id ? `${req.user.id}-` : 'file-'; // Prefix with user ID or generic 'file-'
    const timestamp = Date.now();
    const extension = path.extname(file.originalname); // Get original extension
    const safeOriginalNameBase = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize original base name

    // Construct filename: userId-timestamp-originalBaseName.ext
    // Or if original name is too simple: userId-timestamp.ext
    const finalFilename = `${userIdPrefix}${timestamp}-${safeOriginalNameBase || 'upload'}${extension}`;
    cb(null, finalFilename);
  };

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // The destination function provided in options is responsible for calling cb(error, path)
        // It should also handle directory creation if necessary.
        // For convenience, we can wrap it to log or ensure the base directory from options.destination.
        try {
            options.destination(req, file, (err, destPath) => {
              if (err) return cb(err);
              if (!fs.existsSync(destPath)) {
                  fs.mkdirSync(destPath, { recursive: true });
                  logger.info(`Dynamically created directory: ${destPath}`);
              }
              (process.env.NODE_ENV == 'development' && logger.info(`(UploadMiddleware) Upload destination: ${destPath}`))
              cb(null, destPath);
            });
        } catch (error) {
            logger.error('Error in custom destination function or directory creation:', error);
            cb(error);
        }
    },
    filename: options.filenameGenerator || defaultFilenameGenerator,
  });

  const fileFilter = (req, file, cb) => {
    if (options.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const allowedTypesString = options.allowedMimeTypes.map(type => type.split('/')[1].toUpperCase()).join(', ');
      cb(new AppError(`Invalid file type. Only ${allowedTypesString} are allowed.`, 400), false);
    }
  };

  const multerInstance = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: options.maxFileSize,
    },
  });

  return multerInstance.single(options.fieldName);
};


const handleResumeUpload = createUploadMiddleware({
  fieldName: 'resume',
  allowedMimeTypes: [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
  ],
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  destination: (req, file, cb) => {
    const userId = req.user ? String(req.user.id) : 'anonymous';
    const userResumeDir = path.join(DEFAULT_BASE_UPLOAD_DIR, resumeFolder);
    console.log(userResumeDir)
    // Directory creation is handled by the wrapper in createUploadMiddleware's storage.destination
    cb(null, userResumeDir);
  },
});


const handleProfilePictureUpload = createUploadMiddleware({
  fieldName: 'profilePicture',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxFileSize: 2 * 1024 * 1024, // 2 MB
  destination: (req, file, cb) => {
    const userId = req.user ? String(req.user.id) : 'anonymous_pictures';
    const userPictureDir = path.join(DEFAULT_BASE_UPLOAD_DIR, profilePictureFolder);
    cb(null, userPictureDir);
  },
  filenameGenerator: (req, file, cb) => {
    // Use req.user.id as the base filename and preserve the original extension
    if (!req.user || !req.user.id) {
      // Fallback if user ID is somehow not available (should be caught by auth middleware)
      logger.warn('User ID not found in req.user for filename generation. Using default.');
      // Call the default generator explicitly or implement a fallback.
      // For simplicity here, we'll construct a basic unique name.
      const fallbackName = `profile-${Date.now()}${path.extname(file.originalname)}`;
      return cb(null, fallbackName);
    }
    const extension = path.extname(file.originalname); // e.g., '.jpg', '.png'
    const filename = `${req.user.id}${extension}`; // e.g., 'USER_ID.jpg'
    // const filename = req.user.id
    cb(null, filename);
  }
});


module.exports = {
  createUploadMiddleware,
  handleResumeUpload, 
  handleProfilePictureUpload,
  DEFAULT_BASE_UPLOAD_DIR,
};
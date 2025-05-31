const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { handleResumeUpload, handleProfilePictureUpload } = require('../middlewares/uploadMiddleware');
const { updateProfileRules } = require('../middlewares/validationRules');
const validate = require('../middlewares/validate');
const {jobseekerRole, recruiterRole, adminRole} = require('../constants')

const router = express.Router();

// All routes below are protected
router.use(authMiddleware.protect);

router.get('/', userController.getMe);

// Dynamic validation rules based on user role for updating profile
router.patch(
  '/',
  (req, res, next) => { // Middleware to inject role-specific validation
    const rules = updateProfileRules(req.user.role);
    // Apply validation rules dynamically
    // This is a bit tricky; express-validator expects rules at route definition.
    // A simpler way is to have separate update routes or handle validation inside controller.
    // For MVP, let's assume controller handles partial updates gracefully & rules are broad.
    // Better: create a middleware that runs the rules.
    // Or, for MVP, we can just pass all possible profile fields and let Mongoose validation handle it.
    // Let's create a small dynamic validator application
    const validationChain = updateProfileRules(req.user.role);
    // Run each validator in the chain
    Promise.all(validationChain.map(validation => validation.run(req)))
      .then(() => next())
      .catch(next);
  },
  validate, // This will now pick up errors from the dynamically run rules
  userController.updateMe
);


router.post(
  '/resume',
  authMiddleware.restrictTo(jobseekerRole),
  handleResumeUpload, // 'resume' is the field name in form-data
  userController.uploadResume
);
router.post(
  '/avatar',
  authMiddleware.restrictTo(jobseekerRole, recruiterRole, adminRole),
  handleProfilePictureUpload, // 'resume' is the field name in form-data
  userController.uploadProfilePicture
);
router.delete(
  '/delete',
  authMiddleware.restrictTo(jobseekerRole, recruiterRole),
  userController.deleteUser
);

module.exports = router;
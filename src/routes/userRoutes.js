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
  (req, res, next) => { 
    const rules = updateProfileRules(req.user.role);
    const validationChain = updateProfileRules(req.user.role);
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
router.get(
  '/resume',
  authMiddleware.restrictTo(jobseekerRole, recruiterRole, adminRole),
  userController.downloadResume
);
router.post(
  '/avatar',
  authMiddleware.restrictTo(jobseekerRole),
  handleProfilePictureUpload, // 'resume' is the field name in form-data
  userController.uploadProfilePicture
);
router.delete(
  '/delete',
  authMiddleware.restrictTo(jobseekerRole, recruiterRole),
  userController.deleteUser
);

module.exports = router;
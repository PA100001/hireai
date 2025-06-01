const express = require('express');
const recruiterController = require('../controllers/recruiterController');
const authMiddleware = require('../middlewares/authMiddleware');
const { searchSeekersRules } = require('../middlewares/validationRules');
const validate = require('../middlewares/validate');
const {jobseekerRole, recruiterRole, adminRole} = require('../constants')

const router = express.Router();

router.use(authMiddleware.protect, authMiddleware.restrictTo(recruiterRole, adminRole));
router.post('/seekers', searchSeekersRules(), validate, recruiterController.searchSeekers);

module.exports = router;
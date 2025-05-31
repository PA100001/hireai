const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, isAdmin } = require('../middlewares/authMiddleware'); // Using isAdmin for clarity
// Or use restrictTo(adminRole)
// const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { body, query } = require('express-validator');
const validate = require('../middlewares/validate');
const {jobseekerRole, recruiterRole, adminRole} = require('../constants')


const router = express.Router();

// All admin routes are protected and require admin role
router.use(protect);
router.use(isAdmin); // Or router.use(restrictTo(adminRole));

const updateUserValidationRules = () => [
    body('name').optional().isString().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('role').optional().isIn([jobseekerRole, recruiterRole, adminRole]).withMessage('Invalid role'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('companyName').optional().if(body('role').equals(recruiterRole)).isString(),
    // Add JobSeekerProfile fields if allowing direct update here
];

const listUsersValidationRules = () => [
    query('role').optional().isIn([jobseekerRole, recruiterRole, adminRole]),
    query('page').optional().isInt({min: 1}).toInt(),
    query('limit').optional().isInt({min: 1, max: 100}).toInt(),
    query('sortBy').optional().isString(),
    query('order').optional().isIn(['asc', 'desc']),
    query('search').optional().isString().trim()
];

router.get('/users', listUsersValidationRules(), validate, adminController.getAllUsers);
router.get('/users/stats', adminController.getUserStats); // Basic stats endpoint
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id', updateUserValidationRules(), validate, adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);


module.exports = router;
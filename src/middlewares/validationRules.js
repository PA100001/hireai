const { body, query } = require('express-validator');
const validator = require('validator');
const {jobseekerRole, recruiterRole, adminRole} = require('../constants')

exports.registerRules = () => [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').isIn([jobseekerRole, recruiterRole]).withMessage('Role must be jobSeeker or recruiter'),
  // Optional: Recruiter specific fields if provided at registration
  body('companyName').if(body('role').equals(recruiterRole)).notEmpty().withMessage('Company name is required for recruiters'),
  // Optional: Job Seeker specific fields if provided at registration (less common for initial reg)
];

exports.loginRules = () => [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.updateProfileRules = (role) => {
  const rules = [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  ];

  if (role == jobseekerRole) {
    rules.push(
      body('github').optional().isURL().withMessage('Invalid GitHub URL'),
      body('linkedin').optional().isURL().withMessage('Invalid LinkedIn URL'),
      body('portfolio').optional().isURL().withMessage('Invalid Portfolio URL'),
      // Location fields (all optional)
      body('location.street').optional().isString().trim(),
      body('location.city').optional().isString().trim(),
      body('location.state').optional().isString().trim(),
      body('location.country').optional().isString().trim(),
      body('location.zipCode').optional().isString().trim().isPostalCode('any').withMessage('Invalid zip code'), 
      body('bio').optional().isString(),
    );
  } else if (role == recruiterRole) {
    rules.push(
      body('companyName').optional().notEmpty().withMessage('Company name cannot be empty'),
    );
  }
  return rules;
};



exports.searchSeekersRules = () => [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
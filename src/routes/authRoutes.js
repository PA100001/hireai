const express = require('express');
const authController = require('../controllers/authController');
const { registerRules, loginRules } = require('../middlewares/validationRules');
const validate = require('../middlewares/validate');
const { authLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/register', authLimiter, registerRules(), validate, authController.register);
router.post('/login', authLimiter, loginRules(), validate, authController.login);

module.exports = router;
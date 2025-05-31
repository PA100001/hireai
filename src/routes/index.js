const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const recruiterRoutes = require('./recruiterRoutes');
const adminRoutes = require('./adminRoutes');
const router = express.Router();

router.use('/auth', authRoutes);
router.use('/profile', userRoutes);
router.use('/recruiters', recruiterRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
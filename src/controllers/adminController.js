const User = require('../models/User');
const JobSeekerProfile = require('../models/JobSeekerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');
const {jobseekerRole, recruiterRole, adminRole} = require('../constants');
const { successResponse } = require('../utils/standardApiResponse');
// GET all users with pagination and filtering
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const { role, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search } = req.query;
  const query = {};

  if (role) {
    query.role = role;
  }
  if (search) {
    query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const sortOrder = order === 'asc' ? 1 : -1;

  const users = await User.find(query)
    .populate('profile') // Populate profile regardless of role for info
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(parseInt(limit));

  const totalUsers = await User.countDocuments(query);
  const data = {
    results: users.length,
    totalResults: totalUsers,
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalUsers / limit),
    users
  }
  successResponse(res, 200, '', data)
});

// GET a single user by ID
exports.getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate('profile');

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  successResponse(res, 200, ''. user)
});

// PATCH: Admin updates a user
exports.updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, email, role, isActive, companyName, ...jobSeekerProfileUpdates } = req.body;

  // Fields that can be updated on the User model itself
  const userUpdateData = {};
  if (name !== undefined) userUpdateData.name = name;
  if (email !== undefined) userUpdateData.email = email; // Add uniqueness check if changed
  if (role !== undefined) userUpdateData.role = role;
  if (isActive !== undefined) userUpdateData.isActive = isActive;

  // Handle role change carefully:
  // If role changes, existing profile might need to be nulled or a new one created.
  const currentUser = await User.findById(id);
  if (!currentUser) {
    return next(new AppError('No user found with that ID to update', 404));
  }

  if (role && role !== currentUser.role) {
    userUpdateData.roleModel = null; // Reset roleModel
    userUpdateData.profile = null;   // Nullify existing profile reference

    // If new role is jobSeeker or recruiter, create a new profile
    if (role == jobseekerRole) {
        const newProfile = await JobSeekerProfile.create({ user: id, location: {} });
        userUpdateData.profile = newProfile._id;
        userUpdateData.roleModel = 'JobSeekerProfile';
    } else if (role == recruiterRole) {
        const newProfile = await RecruiterProfile.create({ user: id, companyName: companyName || 'N/A' });
        userUpdateData.profile = newProfile._id;
        userUpdateData.roleModel = 'RecruiterProfile';
    }
    // Delete old profile if it existed and role changed
    if (currentUser.profile) {
        if (currentUser.roleModel === 'JobSeekerProfile') {
            await JobSeekerProfile.findByIdAndDelete(currentUser.profile);
        } else if (currentUser.roleModel === 'RecruiterProfile') {
            await RecruiterProfile.findByIdAndDelete(currentUser.profile);
        }
    }
  }


  const updatedUser = await User.findByIdAndUpdate(id, userUpdateData, {
    new: true,
    runValidators: true
  }).populate('profile');

  if (!updatedUser) {
    return next(new AppError('No user found with that ID to update', 404)); // Should be caught by currentUser check
  }

  // If the user is a jobSeeker and there are profile updates
  if (updatedUser.role == jobseekerRole && Object.keys(jobSeekerProfileUpdates).length > 0) {
    await JobSeekerProfile.findOneAndUpdate({ user: id }, jobSeekerProfileUpdates, { new: true, runValidators: true });
    await updatedUser.populate('profile'); // Re-populate after profile update
  }
  // If the user is a recruiter and companyName is being updated (and role didn't just change to recruiter)
  if (updatedUser.role == recruiterRole && companyName !== undefined && (role ? role == recruiterRole : true)) {
    await RecruiterProfile.findOneAndUpdate({ user: id }, { companyName }, { new: true, runValidators: true });
    await updatedUser.populate('profile'); // Re-populate
  }

  successResponse(res, 200, '', updatedUser)
});


// DELETE a user (soft delete by setting isActive to false, or hard delete)
// For MVP, let's do a hard delete, but mention soft delete as an alternative
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Also delete associated profile
  if (user.profile) {
    if (user.roleModel === 'JobSeekerProfile') {
      await JobSeekerProfile.findByIdAndDelete(user.profile);
    } else if (user.roleModel === 'RecruiterProfile') {
      await RecruiterProfile.findByIdAndDelete(user.profile);
    }
  }
  // Also delete resumes from Cloudinary and local (more complex, out of MVP for admin delete user)

  await User.findByIdAndDelete(req.params.id);
  successResponse(res, 204, '',)
});

// Basic activity/stats (example)
exports.getUserStats = catchAsync(async (req, res, next) => {
    const totalUsers = await User.countDocuments();
    const usersByRole = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $project: { role: '$_id', count: 1, _id: 0 } }
    ]);
    const recentRegistrations = await User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt');

    const data = {
            totalUsers,
            usersByRole,
            recentRegistrations
          };
    successResponse(res, 200, '', data)
});
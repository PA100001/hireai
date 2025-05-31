const jwt = require("jsonwebtoken");
const User = require("../models/User");
const JobSeekerProfile = require("../models/JobSeekerProfile");
const RecruiterProfile = require("../models/RecruiterProfile");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const config = require("../config");
const {jobseekerRole, recruiterRole, adminRole} = require('../constants'); 
const { successResponse } = require("../utils/standardApiResponse");

const signToken = (user) => {
  const tokendata = {
    id: user._id, 
    role: parseInt(user.role),
  };
  return jwt.sign(tokendata, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user);

  // Remove password from output
  user.password = undefined;
  const data = {
      token,
      user,
    };
  successResponse(res, statusCode, '', data)
};

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role, companyName, phone } = req.body;

  if (role == adminRole) {
    return next(new AppError('Admin registration is not allowed through this endpoint.', 403));
  }

  const newUser = await User.create({
    name,
    email,
    password,
    phone,
    role,
    roleModel: role == jobseekerRole ? 'JobSeekerProfile' : 'RecruiterProfile'
  });

  let profile;
  if (role == jobseekerRole) {
    profile = await JobSeekerProfile.create({ 
        user: newUser._id,
        // Initialize location object for job seekers
        location: { street: '', city: '', state: '', country: '', zipCode: '' } 
    });
  } else if (role == recruiterRole) {
    profile = await RecruiterProfile.create({ user: newUser._id, companyName });
  }
  newUser.profile = profile._id;
  await newUser.save({ validateBeforeSave: false });
  await newUser.populate('profile');

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  // 2. Check if user exists && password is correct
  const user = await User.findOne({ email })
    .select("+password")
    .populate("profile");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 3. If everything ok, send token to client
  createSendToken(user, 200, res);
});

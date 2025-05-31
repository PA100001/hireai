const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const JobSeekerProfile = require("../models/JobSeekerProfile");
const RecruiterProfile = require("../models/RecruiterProfile");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const cloudinary = require("../config/cloudinary");
const logger = require("../config/logger");
const { successResponse } = require("../utils/standardApiResponse");
const {
  jobseekerRole,
  recruiterRole,
  adminRole,
  resumeFolder,
  profilePictureFolder,
} = require("../constants");
exports.getMe = catchAsync(async (req, res, next) => {
  // req.user is populated by the 'protect' middleware, including the profile
  if (!req.user) {
    return next(
      new AppError(
        "User not found. This should not happen if protect middleware is working.",
        404
      )
    );
  }
  const data = {
    user: req.user,
  };
  successResponse(res, 200, "", data);
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const { name, email } = req.body;
  const profileUpdates = JSON.parse(req.body.profileUpdates);
  const userId = req.user._id;
  const updatedUserFields = {};
  if (name) updatedUserFields.name = name;
  if (email && email !== req.user.email) {
    // Check if email is being changed
    // Add validation for email uniqueness if it's being changed
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== userId) {
      return next(new AppError("This email address is already in use.", 400));
    }
    updatedUserFields.email = email;
  }

  if (Object.keys(updatedUserFields).length > 0) {
    await User.findByIdAndUpdate(userId, updatedUserFields, {
      new: true,
      runValidators: true,
    });
  }

  let updatedProfile;
  if (req.user.role == jobseekerRole) {
    console.log(profileUpdates);
    updatedProfile = await JobSeekerProfile.findOneAndUpdate(
      { user: userId },
      {
        ...profileUpdates,
        location: {
          street:
            profileUpdates.location.street || req.user.profile.location.street,
          city: profileUpdates.location.city || req.user.profile.location.city,
          state:
            profileUpdates.location.state || req.user.profile.location.state,
          country:
            profileUpdates.location.country ||
            req.user.profile.location.country,
          zipCode:
            profileUpdates.location.zipCode ||
            req.user.profile.location.zipCode,
        },
      }, // Ensure location object is handled
      { new: true, runValidators: true, upsert: false } // upsert: false as profile should exist
    );
  } else if (req.user.role == recruiterRole) {
    updatedProfile = await RecruiterProfile.findOneAndUpdate(
      { user: userId },
      profileUpdates,
      { new: true, runValidators: true, upsert: false }
    );
  }
  // Admins do not have a separate 'profile' document to update via this route in this MVP setup

  if (
    (req.user.role == jobseekerRole || req.user.role == recruiterRole) &&
    !updatedProfile
  ) {
    // This should ideally not happen if profile is created at registration
    return next(new AppError("Profile not found for this user.", 404));
  }

  const user = await User.findById(userId).populate("profile");
  successResponse(res, 200, "", user);
});

exports.uploadProfilePicture = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No profile picture file uploaded.", 400));
  }
  const userToUpdate = await User.findById(req.user._id);
  if (!userToUpdate) {
    // This case should ideally be prevented by the 'protect' middleware
    fs.unlink(req.file.path, (err) => {
      if (err)
        logger.error(
          `Failed to delete orphaned upload for non-existent user: ${req.file.path}`,
          err
        );
    });
    return next(
      new AppError("User not found. Cannot upload profile picture.", 404)
    );
  }
  let cloudinaryResult;
  try {
    // Construct a unique public_id including the folder and user context
    // req.file.filename is unique due to timestamp and user ID (if included by Multer config)
    cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      public_id: req.file.filename.split('/').pop().split('.')[0],
      asset_folder: profilePictureFolder, // Organize by user ID in Cloudinary
      use_asset_folder_as_public_id_prefix: true,
      resource_type: "image", // For PDF/DOCX, 'raw' is often better than 'image' or 'video'
      overwrite: true, // Overwrite if a file with the same public_id exists (e.g., re-upload)
      // Eager transformations for PDF to image (optional, adds processing time)
      // eager: [{ width: 400, height: 300, crop: "limit", format: "jpg" }]
    });
  } catch (error) {
    // Clean up local file if Cloudinary upload fails
    fs.unlink(req.file.path, (err) => {
      if (err)
        logger.error(
          `Failed to delete local file after Cloudinary error: ${req.file.path}`,
          err
        );
    });
    logger.error("Cloudinary Upload Error (Profile Picture):", error);
    return next(
      new AppError("Error uploading profile picture to cloud storage.", 500)
    );
  }

  // Delete old profile picture from Cloudinary if it exists
  if (userToUpdate.profilePictureCloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(
        userToUpdate.profilePictureCloudinaryPublicId,
        { resource_type: "image" }
      );
      logger.info(
        `Old profile picture deleted from Cloudinary: ${userToUpdate.profilePictureCloudinaryPublicId}`
      );
    } catch (err) {
      logger.error(
        `Failed to delete old profile picture from Cloudinary: ${err.message}`
      );
    }
  }

  // Delete old local profile picture if it exists AND it's not the same file we just uploaded
  if (
    userToUpdate.profilePictureLocalPath &&
    fs.existsSync(userToUpdate.profilePictureLocalPath) &&
    userToUpdate.profilePictureLocalPath !== req.file.path
  ) {
    fs.unlink(userToUpdate.profilePictureLocalPath, (err) => {
      if (err)
        logger.error(
          `Failed to delete old local profile picture: ${userToUpdate.profilePictureLocalPath}`,
          err
        );
      else
        logger.info(
          `Old local profile picture deleted: ${userToUpdate.profilePictureLocalPath}`
        );
    });
  }

  // Update User model
  userToUpdate.profilePictureUrl = cloudinaryResult.secure_url;
  userToUpdate.profilePictureCloudinaryPublicId = cloudinaryResult.public_id; // Store the public_id from Cloudinary's response
  userToUpdate.profilePictureLocalPath = req.file.path; // Store full path to new local file
  await userToUpdate.save();

  // The `req.user` from `protect` middleware might be stale if we just updated the user.
  // Fetch the latest user data. `userToUpdate` is the latest.
  // If you populate profile on the user model, do it here if needed for the response.
  await userToUpdate.populate("profile"); // Assuming profile is a path on User model

  const data = userToUpdate;
  successResponse(res, 200, "Profile picture uploaded successfully.", data);
});

exports.uploadResume = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No resume file uploaded.", 400));
  }
  const jobSeekerProfile = await JobSeekerProfile.findOne({
    user: req.user._id,
  });
  if (!jobSeekerProfile) {
    // Clean up uploaded file if profile doesn't exist (edge case)
    fs.unlink(req.file.path, (err) => {
      if (err)
        logger.error(`Failed to delete orphaned upload: ${req.file.path}`, err);
    });
    return next(new AppError("Job Seeker profile not found.", 404));
  }

  // 1. Upload to Cloudinary
  let cloudinaryResult;
  try {
    cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      public_id: req.file.filename,
      asset_folder: resumeFolder, // Organize by user ID in Cloudinary
      use_asset_folder_as_public_id_prefix: true,
      resource_type: "raw", // For PDF/DOCX, 'raw' is often better than 'image' or 'video'
      // Eager transformations for PDF to image (optional, adds processing time)
      // eager: [{ width: 400, height: 300, crop: "limit", format: "jpg" }]
    });
    successResponse(res, 200, "", cloudinaryResult);
  } catch (error) {
    // Clean up local file if Cloudinary upload fails
    fs.unlink(req.file.path, (err) => {
      if (err)
        logger.error(
          `Failed to delete local file after Cloudinary error: ${req.file.path}`,
          err
        );
    });
    console.log(cloudinaryResult);
    logger.error("Cloudinary Upload Error:", error);
    return next(new AppError("Error uploading resume to cloud storage.", 500));
  }

  // 2. Update JobSeekerProfile with Cloudinary URL and local path
  // Delete old resume from Cloudinary if it exists
  if (jobSeekerProfile.resumeUrl) {
    const publicId = jobSeekerProfile.resumeUrl.split("/").pop().split(".")[0]; // Simplistic public_id extraction
    try {
      // Attempt to derive public_id (this might need adjustment based on your Cloudinary folder structure)
      // Example: if URL is .../${resumeFolder}/USER_ID/FILENAME.pdf, public_id is ${resumeFolder}/USER_ID/FILENAME
      // The public_id for 'raw' files includes the folder.
      const parts = jobSeekerProfile.resumeUrl.split("/");
      const versionIndex = parts.findIndex(
        (part) => part.startsWith("v") && /^\d+$/.test(part.substring(1))
      );
      let oldPublicId;
      if (versionIndex !== -1 && parts.length > versionIndex + 1) {
        oldPublicId = parts
          .slice(versionIndex + 1)
          .join("/")
          .split(".")[0];
        // If you stored with a folder like `${resumeFolder}`:
        oldPublicId = `${resumeFolder}/${oldPublicId.split("/").pop()}`;
      }

      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId, {
          resource_type: "raw",
        });
        logger.info(`Old resume deleted from Cloudinary: ${oldPublicId}`);
      }
    } catch (err) {
      logger.error(
        `Failed to delete old resume from Cloudinary: ${err.message}`
      );
    }
  }
  // Delete old local resume if it exists
  if (
    jobSeekerProfile.resumeLocalPath &&
    fs.existsSync(jobSeekerProfile.resumeLocalPath)
  ) {
    fs.unlink(jobSeekerProfile.resumeLocalPath, (err) => {
      if (err)
        logger.error(
          `Failed to delete old local resume: ${jobSeekerProfile.resumeLocalPath}`,
          err
        );
      else
        logger.info(
          `Old local resume deleted: ${jobSeekerProfile.resumeLocalPath}`
        );
    });
  }

  jobSeekerProfile.resumeUrl = cloudinaryResult.secure_url;
  jobSeekerProfile.resumeLocalPath = req.file.path; // Store full path to local file
  await jobSeekerProfile.save();

  // Fetch the updated user with populated profile for the response
  const user = await User.findById(req.user._id).populate("profile");
  successResponse(res, 200, "Resume uploaded successfully.", user);
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError("No user found with that ID", 404));
  }

  // Also delete associated profile
  if (user.profile) {
    if (user.roleModel === "JobSeekerProfile") {
      await JobSeekerProfile.findByIdAndDelete(user.profile);
    } else if (user.roleModel === "RecruiterProfile") {
      await RecruiterProfile.findByIdAndDelete(user.profile);
    }
  }
  // Also delete resumes from Cloudinary and local (more complex, out of MVP for admin delete user)

  await User.findByIdAndDelete(req.user._id);

  res.status(204).json({
    // 204 No Content
    status: "success",
    data: null,
  });
});

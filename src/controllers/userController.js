const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const JobSeekerProfile = require('../models/JobSeekerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const cloudinary = require('../config/cloudinary');
const logger = require('../config/logger');
const { successResponse, errorResponse } = require('../utils/standardApiResponse');

const { jobseekerRole, recruiterRole, adminRole, resumeFolder, profilePictureFolder } = require('../constants');
const config = require('../config'); // For GCP bucket name
const { getGCPBucket } = require('../config/gcpBucket');
const astraDbFunction = require('../config/datastaxAstra');
const { getCoordinatesFromPincode, calculateDistance } = require('../utils/locationUtils');
const extractTextFromPdfAndWord = require('../utils/extractTextFromPdfAndWord');
const { rootPath } = require('../constants');
const groq = require('../config/groq');
const {extractTextFromPdfPromt} = require('../promptMessages/resumeParsingPrompt')

async function storeJobSeekerProfileToAstra(jobSeekerProfile) {
  const companies = jobSeekerProfile.workExperience?.map((exp) => exp.company) || [];
  const jobTitles = jobSeekerProfile.workExperience?.map((exp) => exp.jobTitle) || [];
  const projectTechnologies = jobSeekerProfile.projects?.flatMap((p) => p.technologies || []) || [];
  const certificationNames = jobSeekerProfile.certifications?.map((c) => c.name) || [];

  const data = {
    id: req.user._id.toString(),
    // Location
    city: jobSeekerProfile.location?.city,
    state: jobSeekerProfile.location?.state,
    country: jobSeekerProfile.location?.country,
    lat: jobSeekerProfile.location?.lat,
    lon: jobSeekerProfile.location?.lon,
    // Experience & Professional Level
    yearsOfExperience: jobSeekerProfile.yearsOfExperience,
    seniorityLevel: jobSeekerProfile.seniorityLevel,

    // Work Preferences
    openToRemote: jobSeekerProfile.openToRemote,
    openToRelocation: jobSeekerProfile.openToRelocation,
    desiredEmploymentTypes: jobSeekerProfile.desiredEmploymentTypes,
    desiredIndustries: jobSeekerProfile.desiredIndustries,
    preferredLocations: jobSeekerProfile.preferredLocations,

    // Skills & Tech
    skills: jobSeekerProfile.skills,
    techStack: jobSeekerProfile.techStack,

    // Salary Expectations
    salaryMin: jobSeekerProfile.salaryExpectation?.min,
    salaryMax: jobSeekerProfile.salaryExpectation?.max,
    salaryCurrency: jobSeekerProfile.salaryExpectation?.currency,
    salaryPeriod: jobSeekerProfile.salaryExpectation?.period,

    // Availability
    availableFrom: jobSeekerProfile.availableFrom,
    jobSearchStatus: jobSeekerProfile.jobSearchStatus,

    companies,
    jobTitles,
    projectTechnologies,
    certificationNames,
  };

  const vectorText = `
    Headline: ${jobSeekerProfile.headline || ''}
    Bio: ${jobSeekerProfile.bio || ''}
    Current Position: ${jobSeekerProfile.currentJobTitle || ''} at ${jobSeekerProfile.currentCompany || ''}
    Skills: ${(jobSeekerProfile.skills || []).join(', ')}
    Tech Stack: ${(jobSeekerProfile.techStack || []).join(', ')}

    Work Experience:
    ${(jobSeekerProfile.workExperience || [])
      .map(
        (exp) => `
    ${exp.jobTitle} at ${exp.company} (${exp.startDate?.toISOString().slice(0, 10)} - ${
          exp.currentlyWorking ? 'Present' : exp.endDate?.toISOString().slice(0, 10)
        })
    Location: ${exp.location}
    Description: ${exp.description}
    Achievements: ${(exp.achievements || []).join('; ')}
    Technologies Used: ${(exp.technologiesUsed || []).join(', ')}`
      )
      .join('\n')}

    Projects:
    ${(jobSeekerProfile.projects || [])
      .map(
        (proj) => `
    ${proj.name}: ${proj.description}
    Technologies: ${(proj.technologies || []).join(', ')}`
      )
      .join('\n')}

    Certifications:
    ${(jobSeekerProfile.certifications || [])
      .map(
        (cert) => `
    ${cert.name} from ${cert.issuingOrganization} (Issued: ${cert.issueDate?.toISOString().slice(0, 10)})`
      )
      .join('\n')}`;

  const astraDb = astraDbFunction();
  const collection = astraDb.collection(process.env.ASTRA_RESUME_COLLECTION_NAME);
  try {
    if (jobSeekerProfile.vectorId) {
      const result = await collection.deleteOne({
        _id: jobSeekerProfile.vectorId,
      });
      logger.info('Previous Vector File Deleted');
    }
    const result = await collection.insertOne({
      ...data,
      $vectorize: vectorText,
    });
    jobSeekerProfile.vectorId = result.insertedId;
    await jobSeekerProfile.save();
  } catch (error) {
    logger.error(error);
    return errorResponse(res, 500, '', error);
  }
}

exports.getMe = catchAsync(async (req, res, next) => {
  // req.user is populated by the 'protect' middleware, including the profile
  if (!req.user) {
    return next(new AppError('User not found. This should not happen if protect middleware is working.', 404));
  }
  const data = {
    user: req.user,
  };
  successResponse(res, 200, '', data);
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
      return next(new AppError('This email address is already in use.', 400));
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
    // updatedProfile = await JobSeekerProfile.findOneAndUpdate(
    //   { user: userId },
    //   {
    //     ...profileUpdates,
    //     location: {
    //       street:
    //         profileUpdates.location.street || req.user.profile.location.street,
    //       city: profileUpdates.location.city || req.user.profile.location.city,
    //       state:
    //         profileUpdates.location.state || req.user.profile.location.state,
    //       country:
    //         profileUpdates.location.country ||
    //         req.user.profile.location.country,
    //       zipCode:
    //         profileUpdates.location.zipCode ||
    //         req.user.profile.location.zipCode,
    //     },
    //   }, // Ensure location object is handled
    //   { new: true, runValidators: true, upsert: false } // upsert: false as profile should exist
    // );

    const userId = req.user._id;
    updatedProfile = await JobSeekerProfile.findOneAndUpdate(
      { user: userId },
      { $set: { ...profileUpdates } },
      { new: true, runValidators: true, context: 'query' }
    );
    storeJobSeekerProfileToAstra(updatedProfile);
    if (!updatedProfile) {
      // This can happen if the JobSeekerProfile was somehow deleted or never created.
      // At registration, a profile should always be created.
      logger.warn(`JobSeekerProfile not found for user ${userId} during update. Creating one.`);
      updatedProfile = await JobSeekerProfile.create({
        user: userId,
        ...profileUpdates,
        // Populate default email/fullName from user if not in profileUpdates
        email: profileUpdates.email || req.user.email,
        fullName: profileUpdates.fullName || userUpdateFields.name || req.user.name,
      });
      storeJobSeekerProfileToAstra(updatedProfile);
    }
  } else if (req.user.role == recruiterRole) {
    // updatedProfile = await RecruiterProfile.findOneAndUpdate({ user: userId }, profileUpdates, { new: true, runValidators: true, upsert: false });
    updatedProfile = await RecruiterProfile.findOneAndUpdate(
      { user: userId },
      { $set: profileUpdates },
      { new: true, runValidators: true, upsert: false, context: 'query' }
    );
    if (!updatedProfile) {
      logger.warn(`RecruiterProfile not found for user ${userId} during update. Creating one.`);
      updatedProfile = await RecruiterProfile.create({
        user: userId,
        ...profileUpdates,
      });
    }
  }
  // Admins do not have a separate 'profile' document to update via this route in this MVP setup

  if ((req.user.role == jobseekerRole || req.user.role == recruiterRole) && !updatedProfile) {
    // This should ideally not happen if profile is created at registration
    return next(new AppError('Profile not found for this user.', 404));
  }

  const user = await User.findById(userId).populate('profile');
  successResponse(res, 200, '', user);
});

exports.uploadProfilePicture = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No profile picture file uploaded.', 400));
  }
  const userToUpdate = await User.findById(req.user._id);
  if (!userToUpdate) {
    // This case should ideally be prevented by the 'protect' middleware
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error(`Failed to delete orphaned upload for non-existent user: ${req.file.path}`, err);
    });
    return next(new AppError('User not found. Cannot upload profile picture.', 404));
  }
  let cloudinaryResult;
  try {
    // Construct a unique public_id including the folder and user context
    // req.file.filename is unique due to timestamp and user ID (if included by Multer config)
    cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      public_id: req.file.filename.split('/').pop().split('.')[0],
      asset_folder: profilePictureFolder, // Organize by user ID in Cloudinary
      use_asset_folder_as_public_id_prefix: true,
      resource_type: 'image', // For PDF/DOCX, 'raw' is often better than 'image' or 'video'
      overwrite: true, // Overwrite if a file with the same public_id exists (e.g., re-upload)
      // Eager transformations for PDF to image (optional, adds processing time)
      // eager: [{ width: 400, height: 300, crop: "limit", format: "jpg" }]
    });
  } catch (error) {
    // Clean up local file if Cloudinary upload fails
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error(`Failed to delete local file after Cloudinary error: ${req.file.path}`, err);
    });
    logger.error('Cloudinary Upload Error (Profile Picture):', error);
    return next(new AppError('Error uploading profile picture to cloud storage.', 500));
  }

  // Delete old profile picture from Cloudinary if it exists
  if (userToUpdate.profilePictureCloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(userToUpdate.profilePictureCloudinaryPublicId, { resource_type: 'image' });
      logger.info(`Old profile picture deleted from Cloudinary: ${userToUpdate.profilePictureCloudinaryPublicId}`);
    } catch (err) {
      logger.error(`Failed to delete old profile picture from Cloudinary: ${err.message}`);
    }
  }

  // Delete old local profile picture if it exists AND it's not the same file we just uploaded
  if (
    userToUpdate.profilePictureLocalPath &&
    fs.existsSync(userToUpdate.profilePictureLocalPath) &&
    userToUpdate.profilePictureLocalPath !== req.file.path
  ) {
    fs.unlink(userToUpdate.profilePictureLocalPath, (err) => {
      if (err) logger.error(`Failed to delete old local profile picture: ${userToUpdate.profilePictureLocalPath}`, err);
      else logger.info(`Old local profile picture deleted: ${userToUpdate.profilePictureLocalPath}`);
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
  await userToUpdate.populate('profile'); // Assuming profile is a path on User model

  const data = userToUpdate;
  successResponse(res, 200, 'Profile picture uploaded successfully.', data);
});

exports.uploadResume = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No resume file uploaded.', 400));
  }

  const jobSeekerProfile = await JobSeekerProfile.findOne({
    user: req.user._id,
  });
  if (!jobSeekerProfile) {
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error(`Failed to delete orphaned temp upload: ${req.file.path}`, err);
    });
    return next(new AppError('Job Seeker profile not found.', 404));
  }

  const pdfText = await extractTextFromPdfAndWord(req.file.path);
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: extractTextFromPdfPromt
      },
      {
        role: 'user',
        content: pdfText,
      },
    ],
    // model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    temperature: 1,
    max_completion_tokens: 1024,
    top_p: 1,
    stream: false,
    response_format: {
      type: 'json_object',
    },
    stop: null,
  });

  let updateJobSeekerData = JSON.parse(chatCompletion.choices[0].message.content)
    const updatedProfile = await JobSeekerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updateJobSeekerData  },
      { new: true, runValidators: true, context: 'query' }
    );
  storeJobSeekerProfileToAstra(updatedProfile);

  const bucket = await getGCPBucket();
  const gcpResumeFolder = resumeFolder;
  const gcsFileName = `${req.file.filename}`;
  const gcsFilePath = `${gcpResumeFolder}/${gcsFileName}`;

  try {
    if (jobSeekerProfile.resumeGCSPath) {
      try {
        await bucket.file(jobSeekerProfile.resumeGCSPath).delete({ ignoreNotFound: true });
        logger.info(`Old resume deleted from GCS: ${jobSeekerProfile.resumeGCSPath}`);
      } catch (gcsDeleteError) {
        logger.error(`Failed to delete old resume from GCS: ${jobSeekerProfile.resumeGCSPath}`, gcsDeleteError);
      }
    }

    await bucket.upload(req.file.path, {
      destination: gcsFilePath,
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          originalFilename: req.file.originalname,
          userId: req.user.id.toString(),
          uploadTimestamp: new Date().toISOString(),
        },
      },
    });
    logger.info(`Resume uploaded to GCS: ${gcsFilePath}`);

    jobSeekerProfile.resumeGCSPath = gcsFilePath;
    jobSeekerProfile.resumeOriginalName = req.file.originalname;
    jobSeekerProfile.resumeMimeType = req.file.mimetype;
    jobSeekerProfile.resumeLocalPath = req.file.path;
    await jobSeekerProfile.save();

    // Clean up the temporary local file after successful upload
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error(`Failed to delete temp local resume after GCS upload: ${req.file.path}`, err);
    });

    const user = await User.findById(req.user._id).populate({
      path: 'profile',
    });

    return successResponse(res, 200, 'Resume uploaded successfully.', user);
  } catch (uploadError) {
    logger.error('GCS Upload Error:', uploadError);
    // Clean up the temporary local file if GCS upload fails
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error(`Failed to delete temp local resume after GCS error: ${req.file.path}`, err);
    });
    // return next(new AppError("Error uploading resume to cloud storage.", 500));
    return errorResponse(res, 500, 'Error uploading resume to cloud storage.');
  }
});

exports.downloadResume = catchAsync(async (req, res, next) => {
  // Assuming the resume is for the currently logged-in job seeker
  // Or for an admin/recruiter viewing a specific job seeker's resume
  let seekerProfile;
  let targetUserId = req.user.id; // Default to own resume

  // If a recruiter/admin is downloading, they might provide a userId in params or query
  // This part needs role checking and a way to identify the target job seeker
  if ((req.user.role == recruiterRole || req.user.role == adminRole) && req.params.userId) {
    targetUserId = req.params.userId; // e.g., /api/v1/users/:userId/resume/download
  } else if (req.user.role != jobseekerRole) {
    return next(new AppError('You are not authorized to download this resume or user not specified.', 403));
  }

  seekerProfile = await JobSeekerProfile.findOne({ user: targetUserId });

  if (!seekerProfile || !seekerProfile.resumeGCSPath) {
    // return next(new AppError('Resume not found for this user.', 404));
    return errorResponse(res, 404, 'Resume not found for this user.');
  }

  try {
    const bucket = await getGCPBucket();
    const file = bucket.file(seekerProfile.resumeGCSPath);

    // Check if file exists in GCS (optional, getSignedUrl will fail if not)
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn(`Resume file ${seekerProfile.resumeGCSPath} not found in GCS for user ${targetUserId}.`);
      return errorResponse(res, 404, 'Resume file does not exist in storage.');
    }

    const [metadata] = await file.getMetadata();

    // --- Streaming Logic ---
    // For viewing in browser (inline):
    // Content-Disposition: inline; filename="example.pdf"
    // For forcing download (attachment):
    // Content-Disposition: attachment; filename="example.pdf"

    // Let's default to 'inline' for viewing, frontend can trigger download via link if needed
    // The filename*=UTF-8'' part handles special characters in filenames robustly.
    const dispositionType = req.query.download === 'true' ? 'attachment' : 'inline';
    const encodedFilename = encodeURIComponent(seekerProfile.resumeOriginalName || 'resume.pdf');

    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${seekerProfile.resumeOriginalName || 'resume.pdf'}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader('Content-Type', metadata.contentType || seekerProfile.resumeMimeType || 'application/octet-stream');
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size);
    }

    const readStream = file.createReadStream();

    // Pipe the GCS read stream directly to the HTTP response stream
    readStream.pipe(res);

    readStream.on('error', (gcsStreamError) => {
      logger.error(`Error streaming resume ${seekerProfile.resumeGCSPath} from GCS:`, gcsStreamError);
      // Important: If headers are already sent, you can't send a JSON error response.
      // The connection might just break for the client.
      // Best effort to end the response if possible.
      if (!res.headersSent) {
        return errorResponse(res, 500, 'Error occurred while streaming the resume.');
      } else {
        res.end(); // End the response if headers were already sent
      }
    });

    readStream.on('end', () => {
      logger.info(`Resume ${seekerProfile.resumeGCSPath} streamed successfully to user ${req.user.id}.`);
      // Response is already finished by pipe, no need to call res.end() explicitly here
    });
  } catch (error) {
    logger.error('Error preparing or streaming resume for download:', error);
    if (!res.headersSent) {
      return errorResponse(res, 500, 'Failed to download resume.');
    }
  }
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

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

  await User.findByIdAndDelete(req.user._id);

  res.status(204).json({
    // 204 No Content
    status: 'success',
    data: null,
  });
});

const mongoose = require('mongoose');

const jobSeekerProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  github: String,
  linkedin: String,
  portfolio: String,
  resumeUrl: String,
  resumeLocalPath: String,
  location: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
  },
  bio: String,
  skills: [String],
}, { timestamps: true });

// Text index for searching - include new location fields
jobSeekerProfileSchema.index({
  bio: 'text',
  skills: 'text',
  'location.city': 'text',
  'location.state': 'text',
  'location.country': 'text',
  // You might not want street and zipCode in general keyword search,
  // but they can be indexed if needed for specific queries.
});

// Optional: Compound index for specific location filtering if frequently used
jobSeekerProfileSchema.index({ 'location.city': 1, 'location.state': 1, 'location.country': 1 });


const JobSeekerProfile = mongoose.model('JobSeekerProfile', jobSeekerProfileSchema);
module.exports = JobSeekerProfile;
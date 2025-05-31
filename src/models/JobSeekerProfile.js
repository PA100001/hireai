const mongoose = require('mongoose');

const jobSeekerProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Online presence
  github: String,
  linkedin: String,
  portfolio: String,
  personalWebsite: String,
  twitter: String,

  // Resume Info
  resumeGCSPath: String,
  resumeOriginalName: String,
  resumeMimeType: String,
  resumeLocalPath: String,

  // Personal Details
  location: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
  },

  // Professional Summary
  bio: String,
  headline: String, // e.g., "Senior Backend Developer with 10+ years of experience"
  currentJobTitle: String,
  currentCompany: String,
  noticePeriod: String, // e.g., "2 weeks", "1 month"

  // Skills and Tools
  skills: [String], // e.g., ['Node.js', 'React', 'MongoDB']
  techStack: [String], // broader than skills, includes tools like Git, Docker, etc.
  yearsOfExperience: Number,
  seniorityLevel: {
    type: String,
    enum: ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Architect', 'Manager']
  },

  // Preferences
  desiredJobTitle: String,
  desiredEmploymentTypes: [String], // ['Full-time', 'Part-time', 'Contract', 'Freelance']
  desiredIndustries: [String],
  openToRemote: Boolean,
  openToRelocation: Boolean,
  preferredLocations: [String], // ["Berlin, Germany", "Remote", "New York, USA"]
  salaryExpectation: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    period: {
      type: String,
      enum: ['year', 'month', 'hour']
    }
  },

  // Experience
  workExperience: [{
    jobTitle: String,
    company: String,
    location: String,
    startDate: Date,
    endDate: Date,
    currentlyWorking: Boolean,
    description: String,
    achievements: [String],
    technologiesUsed: [String]
  }],

  // Education
  education: [{
    institution: String,
    degree: String,
    fieldOfStudy: String,
    startDate: Date,
    endDate: Date,
    grade: String,
    honors: String
  }],

  // Certifications
  certifications: [{
    name: String,
    issuingOrganization: String,
    issueDate: Date,
    expirationDate: Date,
    credentialId: String,
    credentialURL: String
  }],

  // Languages
  languages: [{
    language: String,
    proficiency: {
      type: String,
      enum: ['Basic', 'Conversational', 'Fluent', 'Native']
    }
  }],

  // Projects (Portfolio)
  projects: [{
    name: String,
    description: String,
    technologies: [String],
    link: String,
    githubRepo: String,
    startDate: Date,
    endDate: Date
  }],

  // Availability
  availableFrom: Date,
  jobSearchStatus: {
    type: String,
    enum: ['Actively looking', 'Open to opportunities', 'Not looking', 'Employed, but open']
  },

}, { timestamps: true });

// Text index for searching - include new location fields
jobSeekerProfileSchema.index({
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
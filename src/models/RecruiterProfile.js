const mongoose = require('mongoose');

const recruiterProfileSchema = new mongoose.Schema({
  user: { // Link back to the User model
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: String,
  companyWebsite: String,
}, { timestamps: true });

const RecruiterProfile = mongoose.model('RecruiterProfile', recruiterProfileSchema);
module.exports = RecruiterProfile;
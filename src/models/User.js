const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const { jobseekerRole, recruiterRole, adminRole } = require("../constants");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please tell us your name!"],
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 8,
      select: false, // Don't send back password by default
    },
    phone: {
      type: String,
      required: [true, "Please provide a phone"],
      minlength: 10,
      select: false,
    },
    role: {
      type: String,
      enum: [1, 2, 3],
      required: [true, "Please specify a role"],
    },
    // Reference to the role-specific profile
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "roleModel", // Dynamic reference based on 'role'
    },
    profilePictureUrl: String,
    profilePictureCloudinaryPublicId: String, // For easier Cloudinary deletion
    profilePictureLocalPath: String,
    roleModel: {
      // Stores the model name ('JobSeekerProfile' or 'RecruiterProfile')
      type: String,
      required: function () {
        return this.role == jobseekerRole || this.role == recruiterRole;
      },
      enum: ["JobSeekerProfile", "RecruiterProfile", null],
    },
    isActive: {
      // Useful for admin to deactivate users
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model("User", userSchema);
module.exports = User;

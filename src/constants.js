const path = require('path')
module.exports = {
    jobseekerRole : 1,
    recruiterRole : 2,
    adminRole : 3,
    resumeFolder: 'resume',
    profilePictureFolder: 'avatar',
    defaultUploadFolder: 'uploads',
    rootPath: path.join(__dirname, ".."),
}
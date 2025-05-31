const extractTextFromPdfPromt = 
`You'll be given the text extracted from a resume. 
Structure the resume data in json format. Only output the fields having valid data according to the schema.
\nThis data structre is as follows.
\n{
  "github": "String",
  "linkedin": "String",
  "portfolio": "String",
  "personalWebsite": "String",
  "twitter": "String",
  "resumeGCSPath": "String",
  "resumeOriginalName": "String",
  "resumeMimeType": "String",
  "resumeLocalPath": "String",
  "location": {
    "street": "String",
    "city": "String",
    "state": "String",
    "country": "String",
    "zipCode": "String",
    "lat": "Number",
    "lon": "Number"
  },
  "bio": "String",
  "headline": "String",
  "currentJobTitle": "String",
  "currentCompany": "String",
  "noticePeriod": "String",
  "skills": ["String"],
  "techStack": ["String"],
  "yearsOfExperience": "Number",
  "seniorityLevel": "String (Enum: Intern, Junior, Mid, Senior, Lead, Principal, Architect, Manager)",
  "desiredJobTitle": "String",
  "desiredEmploymentTypes": ["String"],
  "desiredIndustries": ["String"],
  "openToRemote": "Boolean",
  "openToRelocation": "Boolean",
  "preferredLocations": ["String"],
  "salaryExpectation": {
    "min": "Number",
    "max": "Number",
    "currency": "String (default: USD)",
    "period": "String (Enum: year, month, hour)"
  },
  "workExperience": [
    {
      "jobTitle": "String",
      "company": "String",
      "location": "String",
      "startDate": "Date",
      "endDate": "Date",
      "currentlyWorking": "Boolean",
      "description": "String",
      "achievements": ["String"],
      "technologiesUsed": ["String"]
    }
  ],
  "education": [
    {
      "institution": "String",
      "degree": "String",
      "fieldOfStudy": "String",
      "startDate": "Date",
      "endDate": "Date",
      "grade": "String",
      "honors": "String"
    }
  ],
  "certifications": [
    {
      "name": "String",
      "issuingOrganization": "String",
      "issueDate": "Date",
      "expirationDate": "Date"
    }
  ],
  "languages": ["String"],
  "projects": [
    {
      "name": "String",
      "description": "String",
      "technologies": ["String"],
      "link": "String",
      "githubRepo": "String",
      "startDate": "Date",
      "endDate": "Date"
    }
  ],
  "availableFrom": "Date",
  "jobSearchStatus": "String (Enum: Actively looking, Open to opportunities, Not looking, Employed, but open)"
}
\nConvert it to valid json. Take care of the dataType and output according to that. if enum or array or object values are not present in resume, remove that field in final json. 
For example - if seniorityLevel is not in resume, remove it from the output json.
`

module.exports = {extractTextFromPdfPromt}

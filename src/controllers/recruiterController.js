const JobSeekerProfile = require("../models/JobSeekerProfile");
const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const {
  successResponse,
  errorResponse,
} = require("../utils/standardApiResponse");

exports.searchSeekers = catchAsync(async (req, res, next) => {
  const {
    keywords,
    city,
    state,
    country,
    location: generalLocation,
    page = 1,
    limit = 10,
  } = req.query;

  const query = {};
  const orLocationConditions = [];

  if (city) {
    query["location.city"] = { $regex: new RegExp(city, "i") };
  }
  if (state) {
    query["location.state"] = { $regex: new RegExp(state, "i") };
  }
  if (country) {
    query["location.country"] = { $regex: new RegExp(country, "i") };
  }

  // If a general 'location' term is provided, search across multiple location fields
  if (generalLocation) {
    const locRegex = { $regex: new RegExp(generalLocation, "i") };
    orLocationConditions.push(
      { "location.city": locRegex },
      { "location.state": locRegex },
      { "location.country": locRegex }
      // Add other fields if you want 'location' to search them too
      // { 'location.street': locRegex },
      // { 'location.zipCode': locRegex }
    );
  }

  if (keywords) {
    query.$text = { $search: keywords };
  }

  // Combine specific location queries with OR conditions for general location
  if (orLocationConditions.length > 0) {
    if (query.$and) {
      // If other query conditions exist (like specific city/state)
      query.$and.push({ $or: orLocationConditions });
    } else if (Object.keys(query).length > 0 && !query.$text) {
      // If only specific location fields are set (e.g. city=X)
      // and we also have general location search, then it's an AND between specific and general parts.
      // This logic can get complex. For MVP, let's simplify: if specific fields (city, state, country) are used,
      // they take precedence. If 'location' (general) is used, it searches broadly.
      // If both are used, combine them.
      // For now, let's assume if city/state/country are given, they form the base.
      // If 'generalLocation' is also given, it acts as an OR condition to what's already there.
      // This might need refinement based on desired search UX.
      // A simpler approach for MVP:
      // If specific city/state/country are present, use them.
      // If ONLY generalLocation is present, use it for OR search.
      // If BOTH are present, it might be confusing.
      // Let's stick to: if generalLocation exists, it adds to an $or, and the main query is $and of all criteria.
      query.$or = query.$or
        ? [...query.$or, ...orLocationConditions]
        : orLocationConditions;
    } else if (orLocationConditions.length > 0 && !query.$text) {
      // Only general location search
      query.$or = orLocationConditions;
    } else if (orLocationConditions.length > 0 && query.$text) {
      // Text search + general location
      // This requires careful structuring if we want $text and $or on location to work together.
      // MongoDB $text search usually needs to be a top-level operator.
      // A common pattern is to have keyword search apply to all text-indexed fields (including location parts)
      // and then use specific filters for city/state/country.
      // For MVP, let's make 'keywords' search all text indexed fields (bio, skills, location parts).
      // And 'city', 'state', 'country' be specific filters.
      // Remove 'generalLocation' for simplicity if 'keywords' covers it.
      // So, if user types "California" in keywords, it will match if "California" is in city/state/country.
      // If they use the 'state' filter for "California", it's more precise.
    }
  }
  // Re-simplifying search logic for MVP with structured location:
  // 'keywords' will search text-indexed fields (bio, skills, location.city, location.state, location.country)
  // Specific filters for 'city', 'state', 'country' will refine this.
  // The 'location' general query param might be redundant if keywords cover it.

  // Revised query logic:
  const findQuery = {};
  if (city) findQuery["location.city"] = { $regex: new RegExp(city, "i") };
  if (state) findQuery["location.state"] = { $regex: new RegExp(state, "i") };
  if (country)
    findQuery["location.country"] = { $regex: new RegExp(country, "i") };

  if (keywords) {
    findQuery.$text = { $search: keywords };
  }

  const skip = (page - 1) * limit;

  const seekersProfiles = await JobSeekerProfile.find(findQuery)
    .select(keywords ? { score: { $meta: "textScore" } } : {}) // Add textScore if keywords are used
    .sort(keywords ? { score: { $meta: "textScore" } } : { createdAt: -1 }) // Sort by relevance or newest
    .limit(limit)
    .skip(skip)
    .populate({
      path: "user",
      select: "name email role",
    });

  if (!seekersProfiles || seekersProfiles.length === 0) {
    const data = {
      results: 0,
      seekers: [],
    };
    return successResponse(res, 404, "No job seekers found matching your criteria", data);
  }

  // Map to a more presentable format if needed, or return as is
  // For now, we return the profiles which include the populated user.

  const totalSeekers = await JobSeekerProfile.countDocuments(query);
  const data = {
    results: seekersProfiles.length,
    totalResults: totalSeekers,
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalSeekers / limit),
    data: {
      seekers: seekersProfiles,
    },
  };
  successResponse(res, 200, "", data);
});

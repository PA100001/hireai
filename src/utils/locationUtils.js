/**
 * Gets the latitude and longitude of a given pincode using OpenStreetMap (Nominatim).
 * @param {string} pincode
 * @returns {Promise<{ lat: number, lon: number }>}
 */
const getCoordinatesFromPincode = async (pincode) => {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&format=json&limit=1`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    if (data.length === 0) {
      throw new Error('No location found for the given pincode.');
    }

    const { lat, lon } = data[0];
    return {
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    };
  } catch (error) {
    console.error('Error fetching coordinates:', error.message);
    throw error;
  }
};

/**
 * Calculates the distance (in kilometers) between two geographic coordinates using the Haversine formula.
 * @param {Object} coord1 - { lat: number, lon: number }
 * @param {Object} coord2 - { lat: number, lon: number }
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (coord1, coord2) => {
  const toRadians = (deg) => (deg * Math.PI) / 180;

  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLon = toRadians(coord2.lon - coord1.lon);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in kilometers
};

module.exports = {
  getCoordinatesFromPincode,
  calculateDistance
};

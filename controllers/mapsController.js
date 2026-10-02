require('dotenv').config();

/**
 * Returns Google Maps API key configuration to frontend
 * If missing, informs client to display a friendly configuration notification
 */
exports.getMapsConfig = (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  res.json({
    success: true,
    hasKey: Boolean(apiKey && apiKey.trim().length > 0),
    apiKey: apiKey ? apiKey.trim() : null,
    message: apiKey ? 'Google Maps key configured' : 'Google Maps API Key is not set in .env. Interactive pin-point and geometric fallback calculations are active.'
  });
};

/**
 * Fallback Route Distance Calculator (using Haversine formula with road winding coefficient)
 * Calculates distance between Start -> Stops -> College
 */
exports.calculateRouteDistance = (req, res) => {
  const { points } = req.body; // Array of { lat, lng } or names

  if (!points || !Array.isArray(points) || points.length < 2) {
    return res.status(400).json({ success: false, message: 'At least 2 points are required to calculate route distance.' });
  }

  function toRad(deg) {
    return deg * (Math.PI / 180);
  }

  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (p1.lat != null && p1.lng != null && p2.lat != null && p2.lng != null) {
      const R = 6371; // Earth radius in km
      const dLat = toRad(p2.lat - p1.lat);
      const dLon = toRad(p2.lng - p1.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const straightLineKm = R * c;
      // Road factor roughly 1.25x straight line in regional terrain
      totalKm += straightLineKm * 1.25;
    }
  }

  const roundedDistance = Math.round(totalKm * 10) / 10;

  res.json({
    success: true,
    distanceKm: roundedDistance,
    formattedDistance: `${roundedDistance} KM`,
    pointsCount: points.length
  });
};

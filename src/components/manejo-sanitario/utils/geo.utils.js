export const CustomCos = (latDegrees) => Math.cos(latDegrees * Math.PI / 180);

export const haversineDistance = (coord1, coord2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
  const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    CustomCos(coord1[0]) * CustomCos(coord2[0]) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateCentroid = (coords) => {
  if (!coords || coords.length === 0) return [3.518, -76.305];
  let sumLat = 0;
  let sumLng = 0;
  coords.forEach(c => {
    sumLat += c[0];
    sumLng += c[1];
  });
  return [sumLat / coords.length, sumLng / coords.length];
};

export const calculatePerimeter = (coords) => {
  if (!coords || coords.length < 3) return 0;
  let perimeter = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    perimeter += haversineDistance(coords[i], coords[i + 1]);
  }
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    perimeter += haversineDistance(coords[coords.length - 1], coords[0]);
  }
  return perimeter;
};

export const calculateArea = (coords) => {
  if (!coords || coords.length < 3) return 0;
  const centroid = calculateCentroid(coords);
  const latR = centroid[0] * Math.PI / 180;

  const R_lat = 111132.954 - 559.822 * Math.cos(2 * latR) + 1.175 * Math.cos(4 * latR);
  const R_lon = 111412.84 * Math.cos(latR) - 93.5 * Math.cos(3 * latR);

  const xy = coords.map(c => [
    (c[1] - centroid[1]) * R_lon,
    (c[0] - centroid[0]) * R_lat
  ]);

  let area = 0;
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xy[i][0] * xy[j][1];
    area -= xy[j][0] * xy[i][1];
  }
  area = Math.abs(area) / 2;
  return area / 10000; // Hectares
};

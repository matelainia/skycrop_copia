export const agronomicThresholds = {
  spraying: {
    wind: { idealMin: 3, idealMax: 12, weight: 25 },
    rainProb: { maxAllowed: 30, weight: 40 },
    humidity: { idealMin: 50, idealMax: 90, weight: 20 },
    temperature: { idealMin: 15, idealMax: 30, weight: 15 }
  },
  irrigation: {
    rainThresholdMm: 5.0,     // Rain threshold above which irrigation should be canceled
    tempMaxThreshold: 32,     // Temperature threshold for high transpiration
    humidityMinThreshold: 45  // Humidity threshold where soil dries quickly
  },
  disease: {
    tempFav: { min: 18, max: 26 },
    humFav: 80                // Humidity threshold favoring fungal pathogens
  },
  harvest: {
    maxRainMm: 2.0,           // Max rainfall allowed during harvest
    maxHumidity: 85           // Max humidity allowed during harvest
  }
};

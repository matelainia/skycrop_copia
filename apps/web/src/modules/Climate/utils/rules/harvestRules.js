import { agronomicThresholds } from '../../config/agronomicThresholds';

/**
 * Evalúa las condiciones para labores de cosecha y postcosecha.
 * Devuelve viabilidad de cosecha.
 */
export const evaluateHarvest = (currentWeather, dailyForecast) => {
  const { relativeHumidity, precipitationProbability } = currentWeather;
  const config = agronomicThresholds.harvest;

  // Lluvia esperada hoy
  const todayForecast = dailyForecast && dailyForecast[0];
  const rainExpectedToday = todayForecast ? todayForecast.precipitationProbability > 40 : false;

  let score = 20;
  let status = 'Viable';
  let badgeClass = 'badge-green';
  let message = 'Condiciones meteorológicas favorables para realizar labores de cosecha y transporte.';

  if (rainExpectedToday || relativeHumidity > config.maxHumidity) {
    score = 85;
    status = 'No Recomendado';
    badgeClass = 'badge-red';
    message = `Riesgo elevado por exceso de humedad (${relativeHumidity}%) o lluvia inminente. El lodo dificulta el tránsito de maquinaria y aumenta la humedad en frutos/granos postcosecha.`;
  } else if (precipitationProbability > 20 || relativeHumidity > 75) {
    score = 45;
    status = 'Precaución';
    badgeClass = 'badge-yellow';
    message = 'Humedad relativa alta o amenaza leve de lluvia. Monitoree el estado del suelo para evitar compactación.';
  }

  return {
    score,
    status,
    badgeClass,
    message,
    details: [
      `Humedad límite: ${config.maxHumidity}% (Actual: ${relativeHumidity}%)`,
      rainExpectedToday ? 'Precipitación pronosticada para hoy.' : 'Sin lluvias mayores hoy.'
    ]
  };
};

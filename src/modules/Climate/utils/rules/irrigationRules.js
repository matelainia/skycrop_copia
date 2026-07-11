import { agronomicThresholds } from '../../config/agronomicThresholds';

/**
 * Evalúa las condiciones para riego.
 * Devuelve un objeto con la recomendación de riego, alertas de evaporación y justificación.
 */
export const evaluateIrrigation = (currentWeather, dailyForecast) => {
  const { temperature, relativeHumidity } = currentWeather;
  const config = agronomicThresholds.irrigation;

  // Buscar si lloverá fuerte hoy o mañana
  const todayForecast = dailyForecast && dailyForecast[0];
  const tomorrowForecast = dailyForecast && dailyForecast[1];

  const rainExpectedToday = todayForecast ? todayForecast.precipitationProbability > 40 : false;
  const rainExpectedTomorrow = tomorrowForecast ? tomorrowForecast.precipitationProbability > 40 : false;

  let recommendation = 'Riego Estándar';
  let badgeClass = 'badge-blue';
  let message = 'Condiciones normales de transpiración y humedad. Seguir plan de riego programado.';
  let score = 30; // 0-100 score of urgency

  if (rainExpectedToday) {
    recommendation = 'Suspender Riego';
    badgeClass = 'badge-red';
    message = 'Se esperan precipitaciones significativas hoy. Cancele el riego para evitar saturación y lavado de nutrientes.';
    score = 5;
  } else if (rainExpectedTomorrow) {
    recommendation = 'Riego Reducido';
    badgeClass = 'badge-yellow';
    message = 'Lluvias pronosticadas para mañana. Se aconseja reducir el riego al 50% para conservar agua y aprovechar la lluvia.';
    score = 15;
  } else if (temperature > config.tempMaxThreshold && relativeHumidity < config.humidityMinThreshold) {
    recommendation = 'Riego Urgente';
    badgeClass = 'badge-red';
    message = `Calor extremo (${temperature.toFixed(1)}°C) y humedad baja (${relativeHumidity}%). Alta tasa de evapotranspiración. Incremente la frecuencia de riego para evitar marchitamiento.`;
    score = 90;
  } else if (temperature > 30 || relativeHumidity < 50) {
    recommendation = 'Aumentar Riego';
    badgeClass = 'badge-yellow';
    message = 'Alta evaporación en curso. Incremente ligeramente el volumen o riegue temprano en la mañana / tarde.';
    score = 65;
  }

  return {
    score,
    recommendation,
    badgeClass,
    message,
    details: [
      `Temperatura: ${temperature.toFixed(1)}°C (Límite crítico: ${config.tempMaxThreshold}°C)`,
      `Humedad Relativa: ${relativeHumidity}%`,
      rainExpectedToday ? 'Lluvia esperada hoy.' : 'Sin pronóstico de lluvias inmediatas.'
    ]
  };
};

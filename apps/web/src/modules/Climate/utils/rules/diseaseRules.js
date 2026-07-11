import { agronomicThresholds } from '../../config/agronomicThresholds';

/**
 * Evalúa las condiciones para desarrollo de enfermedades fúngicas.
 * Devuelve un nivel de riesgo biológico.
 */
export const evaluateDisease = (currentWeather) => {
  const { temperature, relativeHumidity } = currentWeather;
  const config = agronomicThresholds.disease;

  const tempInFavRange = temperature >= config.tempFav.min && temperature <= config.tempFav.max;
  const humidityAboveThreshold = relativeHumidity >= config.humFav;

  let score = 10;
  let status = 'Bajo';
  let badgeClass = 'badge-green';
  let message = 'Condiciones ambientales poco favorables para la incubación de patógenos o esporas de hongos.';

  if (tempInFavRange && humidityAboveThreshold) {
    score = 90;
    status = 'Crítico';
    badgeClass = 'badge-red';
    message = `Condiciones de incubación ideales para hongos (Sigatoka, Roya, Antracnosis). Alta humedad (${relativeHumidity}%) y temperatura moderada (${temperature.toFixed(1)}°C). Aumente el monitoreo visual en campo.`;
  } else if (humidityAboveThreshold) {
    score = 60;
    status = 'Alto';
    badgeClass = 'badge-yellow';
    message = 'Humedad ambiental elevada en curso. Riesgo potencial si la temperatura se estabiliza. Vigilar lotes propensos.';
  } else if (tempInFavRange) {
    score = 35;
    status = 'Medio';
    badgeClass = 'badge-blue';
    message = 'Temperatura en rango óptimo de patógenos, pero la baja humedad ambiente limita la germinación de esporas.';
  }

  return {
    score,
    status,
    badgeClass,
    message,
    details: [
      `Rango óptimo temperatura: ${config.tempFav.min}°C - ${config.tempFav.max}°C (Actual: ${temperature.toFixed(1)}°C)`,
      `Humedad crítica: >= ${config.humFav}% (Actual: ${relativeHumidity}%)`
    ]
  };
};

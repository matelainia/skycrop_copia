import { agronomicThresholds } from '../../config/agronomicThresholds';

/**
 * Calcula el riesgo acumulado de aplicación fitosanitaria (0 - 100).
 * Devuelve un objeto con la puntuación, color y recomendaciones específicas.
 */
export const evaluateSpraying = (currentWeather) => {
  const { windSpeed, relativeHumidity, temperature, precipitationProbability } = currentWeather;
  const config = agronomicThresholds.spraying;

  let windPenalty = 0;
  let windReason = '';
  // Viento (Peso: 25)
  if (windSpeed < config.wind.idealMin) {
    windPenalty = 10;
    windReason = 'Viento muy bajo (< 3 km/h): Riesgo de inversión térmica y deriva por calma.';
  } else if (windSpeed > config.wind.idealMax) {
    if (windSpeed > 15) {
      windPenalty = config.wind.weight; // Max penalty (25)
      windReason = `Viento crítico (${windSpeed.toFixed(1)} km/h): Alto riesgo de deriva física fuera del objetivo.`;
    } else {
      windPenalty = 12;
      windReason = `Viento moderado-alto (${windSpeed.toFixed(1)} km/h): Riesgo leve de deriva.`;
    }
  }

  let rainPenalty = 0;
  let rainReason = '';
  // Probabilidad de Lluvia (Peso: 40)
  if (precipitationProbability > config.rainProb.maxAllowed) {
    rainPenalty = config.rainProb.weight; // Max penalty (40)
    rainReason = `Probabilidad de lluvia crítica (${precipitationProbability}%): Riesgo inminente de lavado del producto.`;
  } else if (precipitationProbability > 15) {
    rainPenalty = 20;
    rainReason = `Probabilidad de lluvia moderada (${precipitationProbability}%): Riesgo medio de lavado.`;
  }

  let humidityPenalty = 0;
  let humidityReason = '';
  // Humedad Relativa (Peso: 20)
  if (relativeHumidity < config.humidity.idealMin) {
    if (relativeHumidity < 40) {
      humidityPenalty = config.humidity.weight; // Max penalty (20)
      humidityReason = `Humedad muy baja (${relativeHumidity}%): Evaporación rápida de la gota antes de hacer contacto.`;
    } else {
      humidityPenalty = 12;
      humidityReason = `Humedad baja (${relativeHumidity}%): Pérdida de eficiencia por evaporación.`;
    }
  } else if (relativeHumidity > config.humidity.idealMax) {
    humidityPenalty = 8;
    humidityReason = `Humedad muy alta (${relativeHumidity}%): Retraso en el secado y riesgo de escorrentía.`;
  }

  let tempPenalty = 0;
  let tempReason = '';
  // Temperatura (Peso: 15)
  if (temperature > config.temperature.idealMax) {
    if (temperature > 33) {
      tempPenalty = config.temperature.weight; // Max penalty (15)
      tempReason = `Temperatura crítica (${temperature.toFixed(1)}°C): Alta tasa de evaporación y riesgo de fitotoxicidad.`;
    } else {
      tempPenalty = 8;
      tempReason = `Temperatura alta (${temperature.toFixed(1)}°C): Riesgo leve de evaporación.`;
    }
  } else if (temperature < config.temperature.idealMin) {
    if (temperature < 10) {
      tempPenalty = 10;
      tempReason = `Temperatura muy baja (${temperature.toFixed(1)}°C): Absorción foliar extremadamente lenta.`;
    } else {
      tempPenalty = 5;
      tempReason = `Temperatura fresca (${temperature.toFixed(1)}°C): Absorción metabólica lenta.`;
    }
  }

  // Puntuación de riesgo acumulado
  const totalScore = windPenalty + rainPenalty + humidityPenalty + tempPenalty;

  // Clasificación del riesgo
  let status = 'Bajo';
  let color = '🟢';
  let badgeClass = 'badge-green';
  let message = 'Condiciones óptimas para realizar aplicaciones fitosanitarias.';

  if (totalScore > 75) {
    status = 'Crítico';
    color = '🔴';
    badgeClass = 'badge-red';
    message = 'Condiciones desfavorables. Se recomienda suspender y reprogramar aplicaciones.';
  } else if (totalScore > 50) {
    status = 'Alto';
    color = '🟠';
    badgeClass = 'badge-yellow'; // Orange style badge
    message = 'Condiciones de riesgo elevado. Realizar únicamente con coadyuvantes o en horas tempranas.';
  } else if (totalScore > 25) {
    status = 'Medio';
    color = '🟡';
    badgeClass = 'badge-blue'; // Yellow/Blue style badge
    message = 'Condiciones aceptables, pero con precauciones por desvíos menores.';
  }

  // Compilar factores detallados de riesgo
  const details = [
    windReason,
    rainReason,
    humidityReason,
    tempReason
  ].filter(Boolean);

  return {
    score: totalScore,
    status,
    color,
    badgeClass,
    message,
    details
  };
};

import { WeatherProviderPort } from '../../../domain/ports/WeatherProviderPort.js';
import { ExternalApiError } from '../../../../../shared/errors/AppErrors.js';

export class OpenMeteoWeatherAdapter extends WeatherProviderPort {
  getName() {
    return 'open-meteo';
  }

  async getForecast(latitude, longitude) {
    const roundedLat = Number(latitude).toFixed(3);
    const roundedLon = Number(longitude).toFixed(3);

    console.log(
      `[OpenMeteoWeatherAdapter] Consultando Open-Meteo para coords: ${roundedLat}, ${roundedLon}`
    );

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto`;

    try {
      const apiResponse = await fetch(weatherUrl);
      if (!apiResponse.ok) {
        throw new Error(`Open-Meteo respondió con código HTTP ${apiResponse.status}`);
      }

      const raw = await apiResponse.json();
      return this.normalize(raw, latitude, longitude);
    } catch (err) {
      throw new ExternalApiError(err.message, 'OpenMeteoAPI', err);
    }
  }

  normalize(raw, lat, lon) {
    const currentWind = raw.current?.wind_speed_10m || 0;
    const currentRain = raw.current?.rain || raw.current?.precipitation || 0;
    const currentUv = raw.hourly?.uv_index ? raw.hourly.uv_index[0] : 0;

    const alerts = [];
    if (currentWind > 20) {
      alerts.push({
        type: 'wind',
        severity: 'warn',
        title: 'Rachas de viento moderadas',
        message: `Vientos de hasta ${currentWind.toFixed(1)} km/h en curso. Tenga precaución con aplicaciones y derivas.`
      });
    }
    if (currentRain > 2.0) {
      alerts.push({
        type: 'rain',
        severity: 'danger',
        title: 'Lluvia persistente',
        message: `Precipitación de ${currentRain.toFixed(1)} mm detectada. Alto riesgo de lavado para fitosanitarios.`
      });
    }
    if (currentUv >= 8) {
      alerts.push({
        type: 'uv',
        severity: 'warn',
        title: 'Índice UV Extremo',
        message: `Radiación UV solar de ${currentUv.toFixed(1)}. Evite la exposición prolongada de operarios en campo.`
      });
    }

    const hourlyData = [];
    if (raw.hourly && Array.isArray(raw.hourly.time)) {
      const limit = Math.min(raw.hourly.time.length, 24);
      for (let i = 0; i < limit; i++) {
        hourlyData.push({
          time: raw.hourly.time[i],
          temperature: raw.hourly.temperature_2m[i],
          precipitationProbability: raw.hourly.precipitation_probability
            ? raw.hourly.precipitation_probability[i]
            : 0,
          relativeHumidity: raw.hourly.relative_humidity_2m[i],
          windSpeed: raw.hourly.wind_speed_10m[i]
        });
      }
    }

    const dailyData = [];
    if (raw.daily && Array.isArray(raw.daily.time)) {
      const limit = Math.min(raw.daily.time.length, 7);
      for (let i = 0; i < limit; i++) {
        dailyData.push({
          date: raw.daily.time[i],
          temperatureMax: raw.daily.temperature_2m_max[i],
          temperatureMin: raw.daily.temperature_2m_min[i],
          precipitationProbability: raw.daily.precipitation_probability_max
            ? raw.daily.precipitation_probability_max[i]
            : 0,
          weatherCode: raw.daily.weather_code[i]
        });
      }
    }

    return {
      version: 1,
      metadata: {
        provider: this.getName(),
        generatedAt: new Date().toISOString(),
        cached: false,
        location: { lat, lon },
        timezone: raw.timezone || 'America/Bogota'
      },
      current: {
        temperature: raw.current?.temperature_2m || 0,
        apparentTemperature: raw.current?.apparent_temperature || raw.current?.temperature_2m || 0,
        relativeHumidity: raw.current?.relative_humidity_2m || 0,
        windSpeed: currentWind,
        windDirection: raw.current?.wind_direction_10m || 0,
        pressure: raw.current?.pressure_msl || 1013,
        precipitationProbability: raw.hourly?.precipitation_probability
          ? raw.hourly.precipitation_probability[0]
          : 0,
        uvIndex: currentUv,
        visibility: raw.hourly?.visibility ? raw.hourly.visibility[0] / 1000 : 10,
        dewPoint: raw.hourly?.dew_point_2m ? raw.hourly.dew_point_2m[0] : 0,
        weatherCode: raw.current?.weather_code || 0
      },
      hourly: hourlyData,
      daily: dailyData,
      alerts
    };
  }
}

export default OpenMeteoWeatherAdapter;

import { WeatherProviderPort } from '../../../domain/ports/WeatherProviderPort.js';
import env from '../../../../shared/config/env.js';
import { ExternalApiError } from '../../../../shared/errors/AppErrors.js';

export class GoogleWeatherAdapter extends WeatherProviderPort {
  getName() {
    return 'google-weather-api';
  }

  async getForecast(latitude, longitude) {
    const googleApiKey = env.GOOGLE_WEATHER_API_KEY;
    if (!googleApiKey) {
      throw new Error('Google Weather API Key no está configurada.');
    }

    const roundedLat = Number(latitude).toFixed(3);
    const roundedLon = Number(longitude).toFixed(3);

    console.log(
      `[GoogleWeatherAdapter] Consultando Google Weather API para coords: ${roundedLat}, ${roundedLon}`
    );

    const currentUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${googleApiKey}&location.latitude=${roundedLat}&location.longitude=${roundedLon}`;
    const hourlyUrl = `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${googleApiKey}&location.latitude=${roundedLat}&location.longitude=${roundedLon}&hours=24`;
    const dailyUrl = `https://weather.googleapis.com/v1/forecast/days:lookup?key=${googleApiKey}&location.latitude=${roundedLat}&location.longitude=${roundedLon}&days=7`;

    try {
      const [resCurrent, resHourly, resDaily] = await Promise.all([
        fetch(currentUrl).then((r) => (r.ok ? r.json() : null)),
        fetch(hourlyUrl).then((r) => (r.ok ? r.json() : null)),
        fetch(dailyUrl).then((r) => (r.ok ? r.json() : null))
      ]);

      if (!resCurrent) {
        throw new Error(
          'La llamada principal de condiciones actuales retornó nulo o fallo de credencial.'
        );
      }

      return this.normalize(resCurrent, resHourly, resDaily, latitude, longitude);
    } catch (err) {
      throw new ExternalApiError(err.message, 'GoogleWeatherAPI', err);
    }
  }

  normalize(resCurrent, resHourly, resDaily, lat, lon) {
    const currentWind = resCurrent.wind?.speed?.value || 0;
    const currentRain = resCurrent.precipitation?.qpf?.quantity || 0;
    const currentUv = resCurrent.uvIndex || 0;

    const alerts = [];
    if (currentWind > 20) {
      alerts.push({
        type: 'wind',
        severity: 'warn',
        title: 'Rachas de viento moderadas',
        message: `Vientos de hasta ${currentWind.toFixed(1)} km/h detectados por Google Weather.`
      });
    }
    if (currentRain > 2.0) {
      alerts.push({
        type: 'rain',
        severity: 'danger',
        title: 'Lluvia persistente',
        message: `Precipitación de ${currentRain.toFixed(1)} mm detectada por Google Weather.`
      });
    }
    if (currentUv >= 8) {
      alerts.push({
        type: 'uv',
        severity: 'warn',
        title: 'Índice UV Extremo',
        message: `Radiación UV solar de ${currentUv.toFixed(1)} (Evitar exposición).`
      });
    }

    const hourlyData = [];
    if (resHourly && Array.isArray(resHourly.forecastHours)) {
      const limit = Math.min(resHourly.forecastHours.length, 24);
      for (let i = 0; i < limit; i++) {
        const h = resHourly.forecastHours[i];
        hourlyData.push({
          time: h.forecastTime,
          temperature: h.temperature?.degrees || 0,
          precipitationProbability: h.precipitation?.probability?.percent || 0,
          relativeHumidity: h.relativeHumidity || 80,
          windSpeed: h.wind?.speed?.value || 0
        });
      }
    }

    const dailyData = [];
    if (resDaily && Array.isArray(resDaily.forecastDays)) {
      const limit = Math.min(resDaily.forecastDays.length, 7);
      for (let i = 0; i < limit; i++) {
        const d = resDaily.forecastDays[i];
        const year = d.displayDate?.year;
        const month = String(d.displayDate?.month || 1).padStart(2, '0');
        const dayNum = String(d.displayDate?.day || 1).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        dailyData.push({
          date: dateStr,
          temperatureMax:
            d.daytimeForecast?.temperature?.degrees || d.temperatureMax?.degrees || 30,
          temperatureMin:
            d.nighttimeForecast?.temperature?.degrees || d.temperatureMin?.degrees || 20,
          precipitationProbability: d.daytimeForecast?.precipitation?.probability?.percent || 0,
          weatherCode: this.mapGoogleTypeToWmo(d.daytimeForecast?.weatherCondition?.type)
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
        timezone: resCurrent.timeZone?.id || 'America/Bogota'
      },
      current: {
        temperature: resCurrent.temperature?.degrees || 0,
        apparentTemperature:
          resCurrent.feelsLikeTemperature?.degrees || resCurrent.temperature?.degrees || 0,
        relativeHumidity: resCurrent.relativeHumidity || 0,
        windSpeed: currentWind,
        windDirection: resCurrent.wind?.direction?.degrees || 0,
        pressure: resCurrent.pressure || 1013,
        precipitationProbability: resCurrent.precipitation?.probability?.percent || 0,
        uvIndex: currentUv,
        visibility: resCurrent.visibility?.distance || 10,
        dewPoint: resCurrent.dewPoint?.degrees || 0,
        weatherCode: this.mapGoogleTypeToWmo(resCurrent.weatherCondition?.type)
      },
      hourly: hourlyData,
      daily: dailyData,
      alerts
    };
  }

  mapGoogleTypeToWmo(type) {
    switch (type?.toUpperCase()) {
      case 'CLEAR':
        return 0;
      case 'MOSTLY_CLEAR':
        return 1;
      case 'PARTLY_CLOUDY':
        return 2;
      case 'MOSTLY_CLOUDY':
        return 3;
      case 'CLOUDY':
        return 3;
      case 'FOG':
        return 45;
      case 'DRIZZLE':
        return 51;
      case 'LIGHT_RAIN':
        return 61;
      case 'RAIN':
        return 63;
      case 'HEAVY_RAIN':
        return 65;
      case 'SHOWER':
        return 80;
      case 'STORM':
        return 95;
      case 'THUNDERSTORM':
        return 95;
      case 'SNOW':
        return 71;
      case 'HAIL':
        return 77;
      default:
        return 1;
    }
  }
}

export default GoogleWeatherAdapter;

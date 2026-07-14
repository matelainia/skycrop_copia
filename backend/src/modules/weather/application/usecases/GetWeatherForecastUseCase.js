import cacheService from '../../../../shared/cache/cache.service.js';
import env from '../../../../shared/config/env.js';

export class GetWeatherForecastUseCase {
  /**
   * @param {WeatherCacheRepositoryPort} cacheRepository Adaptador de persistencia de caché
   * @param {WeatherProviderPort} googleProvider Adaptador de Google Weather
   * @param {WeatherProviderPort} openMeteoProvider Adaptador de Open-Meteo
   */
  constructor(cacheRepository, googleProvider, openMeteoProvider) {
    this.cacheRepository = cacheRepository;
    this.googleProvider = googleProvider;
    this.openMeteoProvider = openMeteoProvider;
  }

  async execute(latitude, longitude) {
    const latVal = parseFloat(latitude);
    const lonVal = parseFloat(longitude);

    // Hash de grilla ~110 metros utilizando 3 decimales
    const roundedLat = latVal.toFixed(3);
    const roundedLon = lonVal.toFixed(3);
    const coordHash = `${roundedLat}_${roundedLon}`;
    const cacheKey = `weather:${coordHash}`;

    // 1. Consultar caché en Supabase (Persistencia)
    try {
      const dbCached = await this.cacheRepository.getCachedWeather(coordHash);
      if (dbCached && dbCached.expiresAt > new Date()) {
        console.log(
          `[GetWeatherForecastUseCase] Cache HIT (Supabase DB) para coords: ${coordHash}`
        );
        const responseData = dbCached.weatherData;
        responseData.metadata.cached = true;
        return responseData;
      }
    } catch (err) {
      console.warn(
        `[GetWeatherForecastUseCase] Error consultando caché de base de datos (contingencia continuará): ${err.message}`
      );
    }

    // 2. Consultar caché en memoria
    const memoryCached = cacheService.get(cacheKey);
    if (memoryCached) {
      console.log(`[GetWeatherForecastUseCase] Cache HIT (Memoria) para coords: ${coordHash}`);
      memoryCached.metadata.cached = true;
      return memoryCached;
    }

    // 3. Selección de Estrategia de Proveedor
    let activeProvider = this.openMeteoProvider;
    if (env.GOOGLE_WEATHER_API_KEY) {
      activeProvider = this.googleProvider;
    }

    console.log(
      `[GetWeatherForecastUseCase] Cache MISS. Ejecutando estrategia de clima: ${activeProvider.getName()}`
    );

    // 4. Invocar el proveedor seleccionado
    const forecast = await activeProvider.getForecast(latVal, lonVal);

    // 5. Establecer fechas de expiración (15 minutos de TTL)
    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    const expiresAtStr = new Date(expiresAtMs).toISOString();
    forecast.metadata.expires = expiresAtStr;

    // 6. Guardar en los repositorios de caché (Silenciar errores de caché para no bloquear el servicio)
    try {
      await this.cacheRepository.saveCachedWeather(
        coordHash,
        latVal,
        lonVal,
        forecast,
        expiresAtStr
      );
      console.log(`[GetWeatherForecastUseCase] Cache SET (Supabase DB) para coords: ${coordHash}`);
    } catch (err) {
      console.warn(
        `[GetWeatherForecastUseCase] Error guardando caché de clima en base de datos: ${err.message}`
      );
    }

    cacheService.set(cacheKey, forecast, 15 * 60 * 1000);
    console.log(`[GetWeatherForecastUseCase] Cache SET (Memoria) para coords: ${coordHash}`);

    return forecast;
  }
}

export default GetWeatherForecastUseCase;

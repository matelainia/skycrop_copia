import { weatherCacheService } from '../services/weatherCacheService';
import { weatherService } from '../services/weatherService';

export const WeatherRepository = {
  /**
   * Obtiene los datos meteorológicos (V1) coordinando caché local e integración remota.
   */
  async getWeather(lat, lon, forceRefresh = false) {
    // 1. Si no se fuerza refresco, intentar leer la caché local del navegador
    if (!forceRefresh) {
      const cached = weatherCacheService.get(lat, lon);
      if (cached) {
        console.log(`[WeatherRepository] Local Cache Hit (Browser) for coords: ${lat}, ${lon}`);
        return cached;
      }
    }

    // 2. Si no hay caché o se fuerza el refresco, consultar al servicio de la API
    console.log(`[WeatherRepository] Cache Miss. Fetching fresh weather for coords: ${lat}, ${lon}`);
    const freshData = await weatherService.fetchWeather(lat, lon);
    
    // 3. Guardar en la caché local del navegador
    if (freshData && freshData.metadata && freshData.metadata.expires) {
      weatherCacheService.set(lat, lon, freshData, freshData.metadata.expires);
    }
    
    return freshData;
  },

  /**
   * Invalida la caché local de coordenadas para permitir la recarga forzada.
   */
  invalidateCache(lat, lon) {
    weatherCacheService.invalidate(lat, lon);
  }
};

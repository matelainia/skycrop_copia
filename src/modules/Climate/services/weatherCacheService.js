import { getCoordinateHash } from '../utils/climateUtils';

const LOCAL_CACHE_KEY_PREFIX = 'skycrop_weather_';

export const weatherCacheService = {
  /**
   * Guarda los datos en localStorage indexados por el hash de coordenadas.
   */
  set(lat, lon, weatherData, expiresAtString) {
    try {
      const hash = getCoordinateHash(lat, lon);
      const key = `${LOCAL_CACHE_KEY_PREFIX}${hash}`;
      
      const cacheObj = {
        coord_hash: hash,
        weather_data: weatherData,
        expires_at: new Date(expiresAtString).getTime()
      };
      
      localStorage.setItem(key, JSON.stringify(cacheObj));
    } catch (err) {
      console.warn('[weatherCacheService] Error setting local weather cache:', err.message);
    }
  },

  /**
   * Lee la caché local y devuelve el JSON si sigue vigente.
   */
  get(lat, lon) {
    try {
      const hash = getCoordinateHash(lat, lon);
      const key = `${LOCAL_CACHE_KEY_PREFIX}${hash}`;
      const saved = localStorage.getItem(key);
      
      if (!saved) return null;
      
      const cacheObj = JSON.parse(saved);
      const now = Date.now();
      
      if (cacheObj.expires_at > now) {
        return cacheObj.weather_data;
      }
      
      // Si expiró, la borramos
      localStorage.removeItem(key);
      return null;
    } catch (err) {
      console.warn('[weatherCacheService] Error reading local weather cache:', err.message);
      return null;
    }
  },

  /**
   * Remueve la caché asociada a las coordenadas dadas.
   */
  invalidate(lat, lon) {
    try {
      const hash = getCoordinateHash(lat, lon);
      const key = `${LOCAL_CACHE_KEY_PREFIX}${hash}`;
      localStorage.removeItem(key);
    } catch (err) {
      console.warn('[weatherCacheService] Error invalidating local cache:', err.message);
    }
  }
};

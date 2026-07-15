import { WeatherCacheRepositoryPort } from '../../../domain/ports/WeatherCacheRepositoryPort.js';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseWeatherCacheRepository extends WeatherCacheRepositoryPort {
  async getCachedWeather(coordHash) {
    try {
      const { data, error } = await supabaseAdmin
        .from('clima_cache')
        .select('weather_data, expires_at')
        .eq('coord_hash', coordHash)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        weatherData: data.weather_data,
        expiresAt: new Date(data.expires_at)
      };
    } catch (err) {
      // Lanzamos DatabaseError para ser atrapado y manejado amigablemente (con fallback de memoria)
      throw new DatabaseError(`Error consultando caché de clima para el hash ${coordHash}`, err);
    }
  }

  async saveCachedWeather(coordHash, latitude, longitude, weatherData, expiresAt) {
    try {
      const { error } = await supabaseAdmin.from('clima_cache').upsert(
        [
          {
            coord_hash: coordHash,
            latitude,
            longitude,
            weather_data: weatherData,
            expires_at: expiresAt
          }
        ],
        { onConflict: 'coord_hash' }
      );

      if (error) throw error;
      return true;
    } catch (err) {
      throw new DatabaseError(
        `Error guardando caché de clima en base de datos para el hash ${coordHash}`,
        err
      );
    }
  }
}

export default SupabaseWeatherCacheRepository;

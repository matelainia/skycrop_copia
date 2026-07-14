import { GeeCacheRepositoryPort } from '../../../domain/ports/GeeCacheRepositoryPort.js';
import { supabaseAdmin } from '../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../shared/errors/AppErrors.js';
import cacheService from '../../../../shared/cache/cache.service.js';

export class SupabaseGeeCacheRepository extends GeeCacheRepositoryPort {
  async getCachedTile(polygonHash) {
    const now = new Date();
    const memoryKey = `gee:${polygonHash}`;

    // 1. Consultar caché en memoria
    const memCached = cacheService.get(memoryKey);
    if (memCached) {
      console.log(`[SupabaseGeeCacheRepository] HIT Memoria para hash: ${polygonHash}`);
      return memCached;
    }

    // 2. Consultar caché en base de datos Supabase
    try {
      const { data, error } = await supabaseAdmin
        .from('gee_cache')
        .select('*')
        .eq('polygon_hash', polygonHash)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const createdAt = new Date(data.created_at);
      const ageMs = now.getTime() - createdAt.getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

      if (ageMs > threeDaysMs) {
        // Expirado: borrar en segundo plano y retornar null
        supabaseAdmin
          .from('gee_cache')
          .delete()
          .eq('id', data.id)
          .catch((err) => {
            console.warn(
              `[SupabaseGeeCacheRepository] Error borrando caché expirada: ${err.message}`
            );
          });
        return null;
      }

      const cacheObj = {
        tileUrl: data.tile_url,
        avgValue: data.avg_value,
        stats: data.histogram_data?.stats || null,
        distribution: data.histogram_data?.distribution || null,
        histogram: data.histogram_data?.histogram || null,
        createdAt
      };

      // Almacenar en caché de memoria
      cacheService.set(memoryKey, cacheObj, threeDaysMs);
      return cacheObj;
    } catch (err) {
      throw new DatabaseError(`Error consultando caché satelital para el hash ${polygonHash}`, err);
    }
  }

  async saveCachedTile(polygonHash, loteId, tileUrl, avgValue, indexType, extraData) {
    const now = new Date();
    const memoryKey = `gee:${polygonHash}`;
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    const cacheObj = {
      tileUrl,
      avgValue,
      stats: extraData?.stats || null,
      distribution: extraData?.distribution || null,
      histogram: extraData?.histogram || null,
      createdAt: now
    };

    // 1. Guardar en memoria
    cacheService.set(memoryKey, cacheObj, threeDaysMs);

    // 2. Guardar en Supabase
    try {
      // Eliminar registros previos para evitar duplicación
      await supabaseAdmin.from('gee_cache').delete().eq('polygon_hash', polygonHash);

      const insertData = {
        lote_id: loteId || null,
        polygon_hash: polygonHash,
        index_type: indexType || 'NDVI',
        tile_url: tileUrl,
        avg_value: avgValue,
        created_at: now.toISOString(),
        histogram_data: extraData
      };

      const { error } = await supabaseAdmin.from('gee_cache').insert([insertData]);

      if (error) {
        // Si falla por la columna histogram_data, realizar fallback sin ella
        if (error.message.includes('column') || error.message.includes('histogram_data')) {
          delete insertData.histogram_data;
          await supabaseAdmin.from('gee_cache').insert([insertData]);
        } else {
          throw error;
        }
      }
      return true;
    } catch (err) {
      throw new DatabaseError(`Error guardando caché satelital para el hash ${polygonHash}`, err);
    }
  }
}

export default SupabaseGeeCacheRepository;

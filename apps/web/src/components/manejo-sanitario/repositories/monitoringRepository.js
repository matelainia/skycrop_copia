import { supabase } from '../services/supabase.service';

export const monitoringRepository = {
  async getByLote(loteId, limit = 50) {
    const { data, error } = await supabase
      .from('monitoreos')
      .select(`
        *,
        objeto_evaluacion:objeto_evaluacion_id (
          id, nombre_comun, categoria
        )
      `)
      .eq('lote_id', loteId)
      .order('fecha_monitoreo', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching monitoreos for lote ${loteId}: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Persiste una nueva evaluación con sus valores dinámicos.
   * @param {Object} payload
   * @param {string} payload.lote_id
   * @param {string} payload.objeto_evaluacion_id
   * @param {string} payload.protocolo_version_id
   * @param {string} payload.tipo_monitoreo
   * @param {string} payload.responsable
   * @param {Object} payload.valores_evaluacion  - JSONB con los valores del protocolo
   * @param {number} payload.incidencia_pct      - Calculado automáticamente si aplica
   * @param {number} payload.severidad_pct
   * @param {number} [payload.humedad_pct]
   * @param {number} [payload.temperatura_c]
   * @param {string} [payload.observaciones]
   */
  async create(payload) {
    const { data, error } = await supabase
      .from('monitoreos')
      .insert({
        lote_id:               payload.lote_id,
        objeto_evaluacion_id:  payload.objeto_evaluacion_id,
        protocolo_version_id:  payload.protocolo_version_id,
        tipo_monitoreo:        payload.tipo_monitoreo || 'Sanitario',
        fecha_monitoreo:       new Date().toISOString(),
        responsable:           payload.responsable,
        valores_evaluacion:    payload.valores_evaluacion || {},
        incidencia_pct:        payload.incidencia_pct || 0,
        severidad_pct:         payload.severidad_pct || 0,
        humedad_pct:           payload.humedad_pct || null,
        temperatura_c:         payload.temperatura_c || null,
        plagas_detectadas:     payload.plagas_detectadas || null,
        enfermedades_detectadas: payload.enfermedades_detectadas || null,
        observaciones:         payload.observaciones || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error al guardar evaluación: ${error.message}`);
    }
    return data;
  }
};

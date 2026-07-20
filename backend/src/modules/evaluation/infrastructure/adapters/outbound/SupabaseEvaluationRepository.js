import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseEvaluationRepository {
  /**
   * Guarda o actualiza un borrador (autosave) en draft_evaluaciones.
   */
  async saveDraft(draftPayload) {
    try {
      const { data, error } = await supabaseAdmin
        .from('draft_evaluaciones')
        .upsert(
          {
            company_id: draftPayload.company_id,
            user_id: draftPayload.user_id,
            lote_id: draftPayload.lote_id,
            step_name: draftPayload.step_name,
            state_data: draftPayload.state_data,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'company_id,user_id,lote_id'
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError('Error guardando borrador de la evaluación', err);
    }
  }

  /**
   * Obtiene un borrador de evaluación activo.
   */
  async getDraft(loteId, userId, companyId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('draft_evaluaciones')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .eq('lote_id', loteId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError('Error recuperando borrador de evaluación', err);
    }
  }

  /**
   * Elimina un borrador de evaluación.
   */
  async deleteDraft(loteId, userId, companyId) {
    try {
      const { error } = await supabaseAdmin
        .from('draft_evaluaciones')
        .delete()
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .eq('lote_id', loteId);

      if (error) throw error;
      return true;
    } catch (err) {
      throw new DatabaseError('Error eliminando borrador de evaluación', err);
    }
  }

  /**
   * Busca la división político-administrativa del lote usando el centroide en PostGIS.
   */
  async findDivisionPolitica(lng, lat) {
    try {
      const point = `POINT(${lng} ${lat})`;
      const { data, error } = await supabaseAdmin
        .from('division_politica')
        .select('departamento, municipio, vereda')
        .filter('geom', 'st_contains', point)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.warn(
        '[SupabaseEvaluationRepository] ST_Contains falló o no existe cartografía:',
        err.message
      );
      return null;
    }
  }

  /**
   * Persiste la evaluación de forma transaccional usando la función RPC.
   */
  async createEvaluation(payload) {
    try {
      const { data, error } = await supabaseAdmin.rpc('guardar_evaluacion_completa', {
        p_company_id: payload.company_id,
        p_lote_id: payload.lote_id,
        p_objeto_evaluacion_id: payload.objeto_evaluacion_id,
        p_protocolo_version_id: payload.protocolo_version_id || null,
        p_tipo_monitoreo: payload.tipo_monitoreo,
        p_responsable: payload.responsable,
        p_valores_evaluacion: payload.valores_evaluacion,
        p_incidencia_pct: payload.incidencia_pct || 0,
        p_severidad_pct: payload.severidad_pct || 0,
        p_humedad_pct: payload.humedad_pct || null,
        p_temperatura_c: payload.temperatura_c || null,
        p_plagas_detectadas: payload.plagas_detectadas || null,
        p_enfermedades_detectadas: payload.enfermedades_detectadas || null,
        p_observaciones: payload.observaciones || null,
        p_user_id: payload.user_id,
        p_estado_sanitario: payload.estado_sanitario || 'excelente'
      });

      if (error) throw error;
      return data; // Retorna el UUID de la evaluación creada
    } catch (err) {
      throw new DatabaseError('Error al crear evaluación en base de datos (RPC)', err);
    }
  }

  /**
   * Obtiene la geometría y coordenadas de un lote específico.
   */
  async getLoteGeom(loteId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('lotes')
        .select('id, company_id, centroide_lat, centroide_lng, geom, area_ha')
        .eq('id', loteId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error obteniendo la geometría del lote ${loteId}`, err);
    }
  }
}

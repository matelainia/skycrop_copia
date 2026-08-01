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
            company_id: draftPayload.company_id || draftPayload.companyId,
            user_id: draftPayload.user_id || draftPayload.userId,
            lote_id: draftPayload.lote_id || draftPayload.loteId,
            step_name: draftPayload.step_name || draftPayload.stepName,
            state_data: draftPayload.state_data || draftPayload.stateData,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'company_id,user_id,lote_id' }
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
   * Persiste la evaluación de forma transaccional usando la RPC v2.
   * Incluye snapshot relacional inmutable, event log y rollback automático.
   *
   * @param {Object} payload - Payload completo de Evaluation.toPayloadV2()
   * @returns {Object} { evaluation_id, snapshot_id, status }
   */
  async createEvaluation(payload) {
    const companyId = payload.p_company_id || payload.company_id;
    const loteId = payload.p_lote_id || payload.lote_id;
    const resp = payload.p_responsable || payload.responsable;
    const userId = payload.p_user_id || payload.user_id;
    const obs = payload.p_observaciones || payload.observaciones;
    const protoId = payload.p_protocol_id || payload.protocolo_version_id || payload.protocol_id;

    try {
      // ── Intentar RPC v2 (nueva arquitectura con snapshot relacional)
      const { data, error } = await supabaseAdmin.rpc('guardar_evaluacion_v2', {
        p_company_id: companyId,
        p_lote_id: loteId,
        p_responsable: resp,
        p_observaciones: obs || null,
        p_user_id: userId,
        // Datos del protocolo snapshot
        p_protocol_id: protoId || null,
        p_protocol_name: payload.p_protocol_name || payload.protocol_name || 'Sin nombre',
        p_protocol_version: payload.p_protocol_version || payload.protocol_version || '1.0',
        p_monitoring_type: payload.p_monitoring_type || payload.tipo_monitoreo || 'Sanitario',
        p_objeto_evaluacion_id:
          payload.p_objeto_evaluacion_id || payload.objeto_evaluacion_id || null,
        p_objeto_evaluacion_name:
          payload.p_objeto_evaluacion_name || payload.objeto_evaluacion_name || '',
        p_object_category: payload.p_object_category || payload.object_category || '',
        p_sampling_method: payload.p_sampling_method || payload.sampling_method || null,
        p_minimum_sample: payload.p_minimum_sample || payload.minimum_sample || null,
        // Resultados calculados
        p_incidence_pct: payload.p_incidence_pct ?? payload.incidencia_pct ?? 0,
        p_severity_pct: payload.p_severity_pct ?? payload.severidad_pct ?? 0,
        p_coverage_pct: payload.p_coverage_pct ?? payload.coverage_pct ?? 0,
        p_risk_level: payload.p_risk_level || payload.risk_level || 'Sin riesgo',
        p_estado_sanitario: payload.p_estado_sanitario || payload.estado_sanitario || 'excelente',
        // Valores legacy (compatibilidad)
        p_valores_evaluacion: payload.p_valores_evaluacion || payload.valores_evaluacion || {},
        // Arrays relacionales del snapshot
        p_snapshot_variables: payload.p_snapshot_variables || payload.snapshot_variables || [],
        p_snapshot_rules: payload.p_snapshot_rules || payload.snapshot_rules || [],
        p_snapshot_thresholds: payload.p_snapshot_thresholds || payload.snapshot_thresholds || [],
        p_snapshot_alerts: payload.p_snapshot_alerts || payload.snapshot_alerts || [],
        p_snapshot_recommendations:
          payload.p_snapshot_recommendations || payload.snapshot_recommendations || []
      });

      if (error) throw error;
      return data; // { evaluation_id, snapshot_id, status }
    } catch (err) {
      // ── Fallback a RPC v1 (compatibilidad legacy) si la v2 no está disponible
      if (err.message?.includes('guardar_evaluacion_v2') || err.code === '42883') {
        console.warn('[SupabaseEvaluationRepository] RPC v2 no disponible, usando fallback v1.');
        return await this._createEvaluationLegacy(payload);
      }
      throw new DatabaseError('Error al crear evaluación en base de datos (RPC v2)', err);
    }
  }

  /**
   * Fallback a la RPC legacy guardar_evaluacion_completa (v1).
   * Se usa mientras la migración 031 no está aplicada en todos los entornos.
   * @private
   */
  async _createEvaluationLegacy(payload) {
    const companyId = payload.p_company_id || payload.company_id;
    const loteId = payload.p_lote_id || payload.lote_id;
    const resp = payload.p_responsable || payload.responsable;
    const userId = payload.p_user_id || payload.user_id;

    try {
      const { data, error } = await supabaseAdmin.rpc('guardar_evaluacion_completa', {
        p_company_id: companyId,
        p_lote_id: loteId,
        p_objeto_evaluacion_id:
          payload.p_objeto_evaluacion_id || payload.objeto_evaluacion_id || null,
        p_protocolo_version_id: payload.p_protocol_id || payload.protocolo_version_id || null,
        p_tipo_monitoreo: payload.p_monitoring_type || payload.tipo_monitoreo || 'Sanitario',
        p_responsable: resp,
        p_valores_evaluacion: payload.p_valores_evaluacion || payload.valores_evaluacion || {},
        p_incidencia_pct: payload.p_incidence_pct ?? payload.incidencia_pct ?? 0,
        p_severidad_pct: payload.p_severity_pct ?? payload.severidad_pct ?? 0,
        p_humedad_pct: null,
        p_temperatura_c: null,
        p_plagas_detectadas: null,
        p_enfermedades_detectadas: null,
        p_observaciones: payload.p_observaciones || payload.observaciones || null,
        p_user_id: userId,
        p_estado_sanitario: payload.p_estado_sanitario || payload.estado_sanitario || 'excelente'
      });

      if (error) throw error;
      return { evaluation_id: data, snapshot_id: null, status: 'CONSOLIDADA' };
    } catch (err) {
      throw new DatabaseError('Error al crear evaluación en base de datos (RPC legacy)', err);
    }
  }

  /**
   * Obtiene la evaluación completa con snapshot usando la función RPC v2.
   * @param {string} evaluationId - UUID de la evaluación
   * @returns {Object} Evaluación completa con snapshot, variables, alertas, eventos, etc.
   */
  async getEvaluationComplete(evaluationId) {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_evaluacion_completa', {
        p_evaluation_id: evaluationId
      });

      if (error) throw error;
      return data;
    } catch (err) {
      throw new DatabaseError(`Error obteniendo evaluación completa ${evaluationId}`, err);
    }
  }

  /**
   * Registra un evento en la bitácora de auditoría.
   * @param {string} evaluationId
   * @param {string} eventType
   * @param {string} description
   * @param {Object} payload
   * @param {string} userId
   */
  async logEvent(evaluationId, eventType, description, payload = {}, userId = null) {
    try {
      const { error } = await supabaseAdmin.from('evaluation_events').insert({
        evaluation_id: evaluationId,
        event_type: eventType,
        description,
        payload,
        user_id: userId
      });

      if (error) throw error;
    } catch (err) {
      console.warn('[SupabaseEvaluationRepository] Error registrando evento:', err.message);
    }
  }

  /**
   * Actualiza el estado de la evaluación (transición de estado del ciclo de vida).
   * @param {string} evaluationId
   * @param {string} newStatus - Estado destino
   * @param {string} userId
   */
  async updateEvaluationStatus(evaluationId, newStatus, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('monitoreos')
        .update({
          evaluation_status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', evaluationId);

      if (error) throw error;

      await this.logEvent(
        evaluationId,
        'ESTADO_CAMBIADO',
        `Estado actualizado a ${newStatus}`,
        { new_status: newStatus },
        userId
      );
      return true;
    } catch (err) {
      throw new DatabaseError(`Error actualizando estado de evaluación a ${newStatus}`, err);
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

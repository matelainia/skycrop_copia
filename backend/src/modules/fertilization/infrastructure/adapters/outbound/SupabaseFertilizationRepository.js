/**
 * SupabaseFertilizationRepository.js
 * Adaptador de salida: implementa el puerto de repositorio usando Supabase.
 * Usa supabaseAdmin (service_role) con validación explícita de company_id,
 * siguiendo el mismo patrón que SupabaseEvaluationRepository.
 */
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError, NotFoundError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseFertilizationRepository {
  /**
   * Obtiene el detalle completo de un plan via RPC.
   * @param {string} planId
   * @param {string} companyId - Para verificación adicional post-RPC
   */
  async getPlanDetail(planId, companyId) {
    try {
      const { data, error } = await supabaseAdmin.rpc('fertilization_get_plan_detail', {
        p_plan_id: planId
      });

      if (error) throw error;
      if (!data) return null;

      // Verificar que el plan pertenece a la empresa del usuario
      if (data.plan && data.plan.company_id && data.plan.company_id !== companyId) {
        return null;
      }

      return data;
    } catch (err) {
      throw new DatabaseError(`Error obteniendo detalle del plan ${planId}`, err);
    }
  }

  /**
   * Crea o actualiza un plan de fertilización.
   * @param {string} companyId
   * @param {string|null} planId
   * @param {Object} data
   */
  async savePlan(companyId, planId, data) {
    try {
      const { data: result, error } = await supabaseAdmin.rpc('fertilization_save_plan', {
        p_company_id: companyId,
        p_plan_id: planId || null,
        p_lote_id: data.loteId || null,
        p_name: data.name,
        p_version: data.version || 'v1.0',
        p_status: data.status || 'draft',
        p_validity_status: data.validityStatus || 'scheduled',
        p_start_date: data.startDate ? data.startDate.toISOString().split('T')[0] : null,
        p_end_date: data.endDate ? data.endDate.toISOString().split('T')[0] : null,
        p_period_label: data.periodLabel || null,
        p_budget_total: data.budgetTotal || 0,
        p_responsible_name: data.responsibleName || null,
        p_responsible_user: data.updatedBy || null,
        p_notes: data.notes || null,
        p_metadata: data.metadata || {},
        p_crop_name: data.cropName || null,
        p_crop_scientific: data.cropScientific || null,
        p_lot_name: data.lotName || null,
        p_sector_name: data.sectorName || null,
        p_farm_name: data.farmName || null,
        p_area_ha: data.areaHa || null,
        p_soil_type: data.soilType || null,
        p_density: data.density || null,
        p_phenological_stage: data.phenologicalStage || null
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    } catch (err) {
      throw new DatabaseError('Error guardando el plan de fertilización', err);
    }
  }

  /**
   * Registra o actualiza una observación con adjuntos y nutrientes.
   * @param {string} planId
   * @param {string} companyId
   * @param {Object} payload
   */
  async saveObservation(planId, companyId, payload) {
    try {
      const { data, error } = await supabaseAdmin.rpc('fertilization_save_observation', {
        p_plan_id: planId,
        p_company_id: companyId,
        p_observation_id: payload.observationId || null,
        p_application_id: payload.applicationId || null,
        p_type: payload.type,
        p_title: payload.title || null,
        p_content: payload.content,
        p_author_user_id: payload.authorUserId || null,
        p_author_name: payload.authorName || null,
        p_is_alert: payload.isAlert || false,
        p_severity: payload.severity || null,
        p_affected_percent: payload.affectedPercent ?? null,
        p_sector: payload.sector || null,
        p_observed_at: payload.observedAt ? new Date(payload.observedAt).toISOString() : null,
        p_metadata: payload.metadata || {},
        p_attachments: payload.attachments || [],
        p_nutrients: payload.nutrients || []
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    } catch (err) {
      throw new DatabaseError('Error guardando la observación de fertilización', err);
    }
  }

  /**
   * Marca una aplicación como completada.
   * @param {string} applicationId
   * @param {string} companyId
   * @param {Object} completionData
   */
  async completeApplication(applicationId, companyId, completionData) {
    try {
      const { data, error } = await supabaseAdmin.rpc('fertilization_complete_application', {
        p_application_id: applicationId,
        p_company_id: companyId,
        p_completion_note: completionData.completionNote || null,
        p_completed_by: completionData.completedBy || null,
        p_dose_applied: completionData.doseApplied || null,
        p_dose_unit: completionData.doseUnit || null,
        p_completed_date: completionData.completedDate
          ? new Date(completionData.completedDate).toISOString().split('T')[0]
          : null
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    } catch (err) {
      throw new DatabaseError(`Error completando la aplicación ${applicationId}`, err);
    }
  }

  /**
   * Agrega un comentario a una observación.
   * @param {string} observationId
   * @param {string} companyId
   * @param {Object} commentData
   */
  async addComment(observationId, companyId, commentData) {
    try {
      // Verificar que la observación pertenece a la empresa
      const { data: obs, error: obsError } = await supabaseAdmin
        .from('fertilization_observations')
        .select('id, plan_id')
        .eq('id', observationId)
        .eq('company_id', companyId)
        .single();

      if (obsError || !obs) {
        throw new NotFoundError('Observación no encontrada o sin acceso');
      }

      const { data, error } = await supabaseAdmin
        .from('fertilization_observation_comments')
        .insert({
          observation_id: observationId,
          company_id: companyId,
          author_user_id: commentData.authorUserId || null,
          author_name: commentData.authorName || null,
          content: commentData.content
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error añadiendo comentario a la observación', err);
    }
  }

  /**
   * Obtiene lista de planes con filtros básicos.
   * Usado por el listado de planes (complementa la implementación mock existente).
   */
  async getPlans(companyId, { page = 1, pageSize = 10, status = null, search = null } = {}) {
    try {
      let query = supabaseAdmin
        .from('fertilization_plans')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (status) query = query.eq('status', status);
      if (search) query = query.ilike('name', `%${search}%`);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    } catch (err) {
      throw new DatabaseError('Error obteniendo planes de fertilización', err);
    }
  }
}

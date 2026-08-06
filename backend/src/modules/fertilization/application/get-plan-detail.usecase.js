/**
 * get-plan-detail.usecase.js
 * Caso de uso: Obtener el detalle completo de un plan de fertilización.
 *
 * Responsabilidades:
 *   1. Validar que se recibe un planId válido.
 *   2. Verificar que el usuario tiene acceso al plan (company_id).
 *   3. Delegar la consulta al repository.
 *   4. Normalizar la respuesta para la UI.
 */
import {
  ValidationError,
  NotFoundError,
  AuthorizationError
} from '../../../shared/errors/AppErrors.js';

export class GetPlanDetailUseCase {
  /** @param {import('../domain/ports.js').FertilizationRepositoryPort} repository */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {string} planId - UUID del plan
   * @param {string} companyId - UUID de la empresa del usuario autenticado
   * @param {string} userId - ID del usuario (para auditoría)
   * @returns {Promise<Object>} Detalle normalizado del plan
   */
  async execute(planId, companyId, userId) {
    if (!planId) {
      throw new ValidationError('planId es requerido');
    }

    if (!companyId) {
      throw new AuthorizationError('Empresa no identificada en la sesión');
    }

    const detail = await this.repository.getPlanDetail(planId, companyId);

    if (!detail || detail.error) {
      throw new NotFoundError(detail?.error || `Plan ${planId} no encontrado`);
    }

    // Verificar que el plan pertenece a la empresa del usuario
    if (detail.plan?.company_id && detail.plan.company_id !== companyId) {
      throw new AuthorizationError('No tienes acceso a este plan de fertilización');
    }

    return this._normalize(detail);
  }

  /**
   * Normaliza la respuesta raw del repository al shape esperado por la UI.
   * @private
   */
  _normalize(detail) {
    const plan = detail.plan || {};
    const apps = detail.applications || [];
    const obs = detail.observations || [];

    return {
      plan: {
        ...plan,
        // Métricas calculadas / expuestas
        progressPct: plan.progress_pct ?? 0,
        applicationsTotal: plan.applications_total ?? apps.length,
        applicationsCompleted:
          plan.applications_completed ?? apps.filter((a) => a.status === 'completed').length,
        observationsTotal: plan.observations_total ?? obs.length,
        attachmentsTotal: plan.attachments_total ?? 0,
        alertsActive: plan.alerts_active ?? 0,
        budgetTotal: plan.budget_total ?? 0,
        budgetExecuted: plan.budget_executed ?? 0
      },
      items: detail.items || [],
      applications: apps,
      nextApp: detail.nextApp || null,
      observations: obs,
      alerts: detail.alerts || [],
      fieldCondition: detail.fieldCondition || null,
      nutrition: detail.nutrition || []
    };
  }
}

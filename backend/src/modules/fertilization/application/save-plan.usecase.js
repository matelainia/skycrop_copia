/**
 * save-plan.usecase.js
 * Caso de uso: Crear o actualizar un plan de fertilización.
 */
import { ValidationError, AuthorizationError } from '../../../shared/errors/AppErrors.js';
import { savePlanSchema } from './schemas.js';

export class SavePlanUseCase {
  /** @param {import('../domain/ports.js').FertilizationRepositoryPort} repository */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {string|null} planId - null para crear, UUID para actualizar
   * @param {string} companyId
   * @param {string} userId
   * @param {Object} data - payload validado
   */
  async execute(planId, companyId, userId, data) {
    if (!companyId) {
      throw new AuthorizationError('Empresa no identificada en la sesión');
    }

    // Validar esquema
    const parsed = savePlanSchema.safeParse(data);
    if (!parsed.success) {
      throw new ValidationError('Datos del plan inválidos', parsed.error.errors);
    }

    return await this.repository.savePlan(companyId, planId, {
      ...parsed.data,
      updatedBy: userId
    });
  }
}

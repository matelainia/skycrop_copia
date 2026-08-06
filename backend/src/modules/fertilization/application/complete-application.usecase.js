/**
 * complete-application.usecase.js
 * Caso de uso: Marcar una aplicación del cronograma como realizada.
 * Recalcula el progreso del plan tras la actualización.
 */
import { ValidationError, AuthorizationError } from '../../../shared/errors/AppErrors.js';
import { completeApplicationSchema } from './schemas.js';

export class CompleteApplicationUseCase {
  /** @param {import('../domain/ports.js').FertilizationRepositoryPort} repository */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {string} applicationId
   * @param {string} companyId
   * @param {string} userId
   * @param {Object} data
   */
  async execute(applicationId, companyId, userId, data) {
    if (!companyId) {
      throw new AuthorizationError('Empresa no identificada en la sesión');
    }

    const parsed = completeApplicationSchema.safeParse({ ...data, applicationId });
    if (!parsed.success) {
      throw new ValidationError('Datos de completado inválidos', parsed.error.errors);
    }

    return await this.repository.completeApplication(applicationId, companyId, {
      completionNote: parsed.data.completionNote || null,
      doseApplied: parsed.data.doseApplied || null,
      doseUnit: parsed.data.doseUnit || null,
      completedDate: parsed.data.completedDate || null,
      completedBy: userId
    });
  }
}

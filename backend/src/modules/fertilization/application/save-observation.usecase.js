/**
 * save-observation.usecase.js
 * Caso de uso: Registrar o actualizar una observación de campo.
 * Incluye adjuntos, nutrientes y generación de alerta si is_alert=true.
 */
import { ValidationError, AuthorizationError } from '../../../shared/errors/AppErrors.js';
import { saveObservationSchema } from './schemas.js';

export class SaveObservationUseCase {
  /**
   * @param {import('../domain/ports.js').FertilizationRepositoryPort} repository
   */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {string} planId
   * @param {string} companyId
   * @param {string} userId
   * @param {string} authorName
   * @param {Object} data - payload crudo del request
   */
  async execute(planId, companyId, userId, authorName, data) {
    if (!companyId) {
      throw new AuthorizationError('Empresa no identificada en la sesión');
    }

    // Validar esquema
    const parsed = saveObservationSchema.safeParse({ ...data, planId });
    if (!parsed.success) {
      throw new ValidationError('Datos de observación inválidos', parsed.error.errors);
    }

    const payload = parsed.data;

    // Regla de negocio: si es alerta, la severidad es recomendada (pero no bloqueante)
    // Se puede extender con más reglas aquí sin tocar la infraestructura.

    return await this.repository.saveObservation(planId, companyId, {
      observationId: payload.observationId || null,
      applicationId: payload.applicationId || null,
      type: payload.type,
      title: payload.title || null,
      content: payload.content,
      authorUserId: userId,
      authorName: authorName || payload.authorName || null,
      isAlert: payload.isAlert,
      severity: payload.severity || null,
      affectedPercent: payload.affectedPercent ?? null,
      sector: payload.sector || null,
      observedAt: payload.observedAt || null,
      metadata: payload.metadata,
      attachments: payload.attachments,
      nutrients: payload.nutrients
    });
  }
}

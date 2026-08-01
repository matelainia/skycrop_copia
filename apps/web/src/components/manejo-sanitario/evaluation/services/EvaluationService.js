import { EvaluationRepository } from '../repositories/EvaluationRepository';
import { Evaluation } from '../domain/entities/Evaluation';
import { EvaluationDraft } from '../domain/entities/EvaluationDraft';

export const EvaluationService = {
  /**
   * Guarda un borrador de evaluación.
   * @param {EvaluationDraft} draftInstance
   */
  async saveDraft(draftInstance) {
    if (!(draftInstance instanceof EvaluationDraft)) {
      throw new Error('Debe proporcionar una instancia válida de EvaluationDraft');
    }
    return await EvaluationRepository.saveDraft(draftInstance.toPayload());
  },

  /**
   * Obtiene el borrador activo para un lote/usuario/empresa.
   * @param {string} loteId
   * @param {string} userId
   * @param {string} companyId
   * @returns {Promise<EvaluationDraft|null>}
   */
  async getDraft(loteId, userId, companyId) {
    const raw = await EvaluationRepository.getDraft(loteId, userId, companyId);
    if (!raw) return null;
    return new EvaluationDraft({
      id:        raw.id,
      companyId: raw.company_id,
      userId:    raw.user_id,
      loteId:    raw.lote_id,
      stepName:  raw.step_name,
      stateData: raw.state_data,
      updatedAt: raw.updated_at
    });
  },

  /**
   * Realiza la geocodificación inversa del lote.
   * @param {string} loteId
   */
  async geocodeLote(loteId) {
    return await EvaluationRepository.geocodeLote(loteId);
  },

  /**
   * Envía la evaluación finalizada al backend.
   * Usa el payload v2 si el evaluation tiene protocolSnapshot disponible,
   * de lo contrario usa el payload legacy (compatibilidad).
   *
   * @param {Evaluation} evaluationInstance
   * @param {string} userId
   * @returns {Promise<Object>} { evaluation_id, snapshot_id, status } o UUID legacy
   */
  async submitEvaluation(evaluationInstance, userId) {
    if (!(evaluationInstance instanceof Evaluation)) {
      throw new Error('Debe proporcionar una instancia de Evaluation válida');
    }

    // Usar v2 si hay snapshot disponible
    if (evaluationInstance.protocolSnapshot) {
      const payload = evaluationInstance.toPayloadV2(userId);
      return await EvaluationRepository.createEvaluation(payload);
    }

    // Fallback legacy
    const payload = {
      ...evaluationInstance.toPayload(userId),
      user_id: userId
    };
    return await EvaluationRepository.createEvaluation(payload);
  }
};

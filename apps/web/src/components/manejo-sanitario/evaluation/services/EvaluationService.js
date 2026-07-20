import { EvaluationRepository } from '../repositories/EvaluationRepository';
import { Evaluation } from '../domain/entities/Evaluation';
import { EvaluationDraft } from '../domain/entities/EvaluationDraft';
import { EvaluationProtocol } from '../domain/entities/EvaluationProtocol';

export const EvaluationService = {
  /**
   * Guarda un borrador de evaluación.
   * @param {EvaluationDraft} draftInstance
   * @returns {Promise<Object>}
   */
  async saveDraft(draftInstance) {
    if (!(draftInstance instanceof EvaluationDraft)) {
      throw new Error('Debe proporcionar una instancia válida de EvaluationDraft');
    }
    return await EvaluationRepository.saveDraft(draftInstance.toPayload());
  },

  /**
   * Obtiene el borrador activo.
   * @param {string} loteId
   * @param {string} userId
   * @param {string} companyId
   * @returns {Promise<EvaluationDraft|null>}
   */
  async getDraft(loteId, userId, companyId) {
    const raw = await EvaluationRepository.getDraft(loteId, userId, companyId);
    if (!raw) return null;
    return new EvaluationDraft({
      id: raw.id,
      companyId: raw.company_id,
      userId: raw.user_id,
      loteId: raw.lote_id,
      stepName: raw.step_name,
      stateData: raw.state_data,
      updatedAt: raw.updated_at
    });
  },

  /**
   * Realiza la geocodificación inversa del lote.
   * @param {string} loteId
   * @returns {Promise<{ departamento: string, municipio: string, vereda: string, coordenadas: string, centroide: number[] }>}
   */
  async geocodeLote(loteId) {
    return await EvaluationRepository.geocodeLote(loteId);
  },

  /**
   * Guarda de forma transaccional una evaluación finalizada.
   * @param {Evaluation} evaluationInstance
   * @param {string} userId - ID del usuario actual para la bitácora
   * @returns {Promise<string>} UUID de la evaluación registrada
   */
  async submitEvaluation(evaluationInstance, userId) {
    if (!(evaluationInstance instanceof Evaluation)) {
      throw new Error('Debe proporcionar una instancia de Evaluation válida');
    }
    const payload = {
      ...evaluationInstance.toPayload(),
      user_id: userId
    };
    return await EvaluationRepository.createEvaluation(payload);
  }
};

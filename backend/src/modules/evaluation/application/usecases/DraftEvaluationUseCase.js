export class DraftEvaluationUseCase {
  constructor(evaluationRepository) {
    this.repo = evaluationRepository;
  }

  /**
   * Guarda o actualiza un borrador.
   */
  async saveDraft(payload) {
    if (!payload.lote_id || !payload.user_id || !payload.company_id) {
      return { success: false, error: 'lote_id, user_id y company_id son requeridos' };
    }

    try {
      const data = await this.repo.saveDraft(payload);
      return { success: true, data };
    } catch (err) {
      console.error('[DraftEvaluationUseCase] saveDraft error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Obtiene el borrador activo para un usuario, lote y empresa.
   */
  async getDraft(loteId, userId, companyId) {
    if (!loteId || !userId || !companyId) {
      return { success: false, error: 'loteId, userId y companyId son requeridos' };
    }

    try {
      const data = await this.repo.getDraft(loteId, userId, companyId);
      return { success: true, data };
    } catch (err) {
      console.error('[DraftEvaluationUseCase] getDraft error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Elimina el borrador.
   */
  async deleteDraft(loteId, userId, companyId) {
    if (!loteId || !userId || !companyId) {
      return { success: false, error: 'loteId, userId y companyId son requeridos' };
    }

    try {
      await this.repo.deleteDraft(loteId, userId, companyId);
      return { success: true };
    } catch (err) {
      console.error('[DraftEvaluationUseCase] deleteDraft error:', err);
      return { success: false, error: err.message };
    }
  }
}

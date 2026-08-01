export class CreateEvaluationUseCase {
  constructor(evaluationRepository) {
    this.repo = evaluationRepository;
  }

  /**
   * Ejecuta el registro de la evaluación transaccional.
   */
  async execute(payload) {
    const loteId = payload.lote_id || payload.p_lote_id;
    const objetoEvaluacionId = payload.objeto_evaluacion_id || payload.p_objeto_evaluacion_id;
    const responsable = payload.responsable || payload.p_responsable;

    if (!loteId) {
      return { success: false, error: 'lote_id es requerido' };
    }
    if (!objetoEvaluacionId) {
      return { success: false, error: 'objeto_evaluacion_id es requerido' };
    }
    if (!responsable) {
      return { success: false, error: 'responsable es requerido' };
    }

    try {
      const result = await this.repo.createEvaluation(payload);
      return {
        success: true,
        data: typeof result === 'object' ? result : { id: result }
      };
    } catch (err) {
      console.error('[CreateEvaluationUseCase] Error:', err);
      return {
        success: false,
        error: err.message || 'Error registrando evaluación transaccional'
      };
    }
  }
}

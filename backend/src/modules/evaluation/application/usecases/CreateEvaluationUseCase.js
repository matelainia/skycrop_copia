export class CreateEvaluationUseCase {
  constructor(evaluationRepository) {
    this.repo = evaluationRepository;
  }

  /**
   * Ejecuta el registro de la evaluación transaccional.
   */
  async execute(payload) {
    if (!payload.lote_id) {
      return { success: false, error: 'lote_id es requerido' };
    }
    if (!payload.objeto_evaluacion_id) {
      return { success: false, error: 'objeto_evaluacion_id es requerido' };
    }
    if (!payload.responsable) {
      return { success: false, error: 'responsable es requerido' };
    }

    try {
      const evaluationId = await this.repo.createEvaluation(payload);
      return {
        success: true,
        data: {
          id: evaluationId
        }
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

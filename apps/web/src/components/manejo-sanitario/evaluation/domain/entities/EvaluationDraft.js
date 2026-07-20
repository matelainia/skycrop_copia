/**
 * Clase de dominio que representa un Borrador (Draft) de Evaluación guardado automáticamente.
 */
export class EvaluationDraft {
  constructor({
    id = null,
    companyId,
    userId,
    loteId,
    stepName = 'LOT_SELECTED',
    stateData = {},
    updatedAt = null
  }) {
    this.id = id;
    this.companyId = companyId;
    this.userId = userId;
    this.loteId = loteId;
    this.stepName = stepName;
    this.stateData = stateData;
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  /**
   * Convierte la entidad a un payload crudo para la base de datos.
   */
  toPayload() {
    return {
      company_id: this.companyId,
      user_id: this.userId,
      lote_id: this.loteId,
      step_name: this.stepName,
      state_data: this.stateData
    };
  }
}

/**
 * Clase de dominio que representa una Evaluación Fitosanitaria/Agronómica finalizada.
 */
export class Evaluation {
  constructor({
    id = null,
    companyId,
    loteId,
    objetoEvaluacionId,
    protocoloVersionId,
    tipoMonitoreo = 'Sanitario',
    responsable,
    valoresEvaluacion = {},
    incidenciaPct = 0,
    severidadPct = 0,
    humedadPct = null,
    temperaturaC = null,
    plagasDetectadas = null,
    enfermedadesDetectadas = null,
    observaciones = '',
    estadoSanitario = 'excelente',
    fechaMonitoreo = null
  }) {
    this.id = id;
    this.companyId = companyId;
    this.loteId = loteId;
    this.objetoEvaluacionId = objetoEvaluacionId;
    this.protocoloVersionId = protocoloVersionId;
    this.tipoMonitoreo = tipoMonitoreo;
    this.responsable = responsable;
    this.valoresEvaluacion = valoresEvaluacion;
    this.incidenciaPct = incidenciaPct;
    this.severidadPct = severidadPct;
    this.humedadPct = humedadPct;
    this.temperaturaC = temperaturaC;
    this.plagasDetectadas = plagasDetectadas;
    this.enfermedadesDetectadas = enfermedadesDetectadas;
    this.observaciones = observaciones;
    this.estadoSanitario = estadoSanitario;
    this.fechaMonitoreo = fechaMonitoreo || new Date().toISOString();
  }

  /**
   * Convierte la entidad a un payload crudo para enviar al backend.
   */
  toPayload() {
    return {
      company_id: this.companyId,
      lote_id: this.loteId,
      objeto_evaluacion_id: this.objetoEvaluacionId,
      protocolo_version_id: this.protocoloVersionId,
      tipo_monitoreo: this.tipoMonitoreo,
      responsable: this.responsable,
      valores_evaluacion: this.valoresEvaluacion,
      incidencia_pct: this.incidenciaPct,
      severidad_pct: this.severidadPct,
      humedad_pct: this.humedadPct,
      temperatura_c: this.temperaturaC,
      plagas_detectadas: this.plagasDetectadas,
      enfermedades_detectadas: this.enfermedadesDetectadas,
      observaciones: this.observaciones,
      estado_sanitario: this.estadoSanitario
    };
  }
}

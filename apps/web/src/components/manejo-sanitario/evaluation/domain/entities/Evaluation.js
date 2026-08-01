/**
 * Evaluation
 * ==========
 * Entidad de dominio que representa una Evaluación Agronómica finalizada.
 * Incluye el snapshot del protocolo utilizado, los resultados de los motores
 * de cálculo y reglas, y los datos relacionales del snapshot para persistir
 * en la arquitectura v2 (guardar_evaluacion_v2).
 */
export class Evaluation {
  constructor({
    // Identificación
    id                    = null,
    companyId,
    loteId,
    // Objeto y protocolo
    objetoEvaluacionId,
    protocoloVersionId,
    // Datos de monitoreo
    tipoMonitoreo         = 'Sanitario',
    responsable,
    valoresEvaluacion     = {},
    // Métricas calculadas
    incidenciaPct         = 0,
    severidadPct          = 0,
    humedadPct            = null,
    temperaturaC          = null,
    // Texto libre
    plagasDetectadas      = null,
    enfermedadesDetectadas = null,
    observaciones         = '',
    estadoSanitario       = 'excelente',
    fechaMonitoreo        = null,
    // ── NUEVO v2: Snapshot del protocolo y resultados de los motores ──
    protocolSnapshot      = null,
    calculationResult     = null,
    ruleResult            = null,
    snapshotVariables     = [],
    snapshotRules         = [],
    snapshotThresholds    = [],
    snapshotAlerts        = [],
    snapshotRecommendations = []
  }) {
    this.id                     = id;
    this.companyId              = companyId;
    this.loteId                 = loteId;
    this.objetoEvaluacionId     = objetoEvaluacionId;
    this.protocoloVersionId     = protocoloVersionId;
    this.tipoMonitoreo          = tipoMonitoreo;
    this.responsable            = responsable;
    this.valoresEvaluacion      = valoresEvaluacion;
    this.incidenciaPct          = incidenciaPct;
    this.severidadPct           = severidadPct;
    this.humedadPct             = humedadPct;
    this.temperaturaC           = temperaturaC;
    this.plagasDetectadas       = plagasDetectadas;
    this.enfermedadesDetectadas = enfermedadesDetectadas;
    this.observaciones          = observaciones;
    this.estadoSanitario        = estadoSanitario;
    this.fechaMonitoreo         = fechaMonitoreo || new Date().toISOString();
    // v2: snapshot y resultados
    this.protocolSnapshot       = protocolSnapshot;
    this.calculationResult      = calculationResult;
    this.ruleResult             = ruleResult;
    this.snapshotVariables      = snapshotVariables;
    this.snapshotRules          = snapshotRules;
    this.snapshotThresholds     = snapshotThresholds;
    this.snapshotAlerts         = snapshotAlerts;
    this.snapshotRecommendations = snapshotRecommendations;
  }

  /**
   * Convierte la entidad al payload para la API v2 y la RPC guardar_evaluacion_v2.
   * Proporciona nombres snake_case estándar (lote_id, company_id) y con prefijo p_
   * para garantizar compatibilidad completa con validaciones del backend y RPC.
   *
   * @param {string} userId - ID del usuario autenticado
   * @returns {Object}
   */
  toPayloadV2(userId) {
    const snap = this.protocolSnapshot || {};
    const calc = this.calculationResult || {};
    const rule = this.ruleResult || {};

    const objId = snap.evaluation_object_id || this.objetoEvaluacionId || null;
    const protId = snap.protocol_id || this.protocoloVersionId || null;

    return {
      // ── Claves estándar (para validación en UseCases del backend)
      company_id:              this.companyId,
      lote_id:                 this.loteId,
      objeto_evaluacion_id:    objId,
      protocolo_version_id:    protId,
      tipo_monitoreo:          snap.monitoring_type || this.tipoMonitoreo,
      responsable:             this.responsable,
      observaciones:           this.observaciones || null,
      user_id:                 userId,
      incidencia_pct:          this.incidenciaPct,
      severidad_pct:           this.severidadPct,
      estado_sanitario:        this.estadoSanitario,
      valores_evaluacion:      this.valoresEvaluacion,

      // ── Claves con prefijo p_ (para la función RPC guardar_evaluacion_v2 de Supabase)
      p_company_id:              this.companyId,
      p_lote_id:                 this.loteId,
      p_responsable:             this.responsable,
      p_observaciones:           this.observaciones || null,
      p_user_id:                 userId,
      p_protocol_id:             protId,
      p_protocol_name:           snap.protocol_name           || 'Sin nombre',
      p_protocol_version:        snap.protocol_version        || '1.0',
      p_monitoring_type:         snap.monitoring_type         || this.tipoMonitoreo,
      p_objeto_evaluacion_id:    objId,
      p_objeto_evaluacion_name:  snap.evaluation_object_name  || '',
      p_object_category:         snap.object_category         || '',
      p_sampling_method:         snap.sampling_method         || null,
      p_minimum_sample:          snap.minimum_sample          || null,
      p_incidence_pct:           this.incidenciaPct,
      p_severity_pct:            this.severidadPct,
      p_coverage_pct:            calc.coveragePct             || 0,
      p_risk_level:              rule.globalRiskLevel         || 'Sin riesgo',
      p_estado_sanitario:        this.estadoSanitario,
      p_valores_evaluacion:      this.valoresEvaluacion,
      p_snapshot_variables:      this.snapshotVariables,
      p_snapshot_rules:          this.snapshotRules,
      p_snapshot_thresholds:     this.snapshotThresholds,
      p_snapshot_alerts:         this.snapshotAlerts,
      p_snapshot_recommendations: this.snapshotRecommendations
    };
  }

  /**
   * Payload legacy para compatibilidad con guardar_evaluacion_completa (v1).
   * @param {string} userId
   * @returns {Object}
   */
  toPayload(userId) {
    return {
      company_id:              this.companyId,
      lote_id:                 this.loteId,
      objeto_evaluacion_id:    this.objetoEvaluacionId,
      protocolo_version_id:    this.protocoloVersionId,
      tipo_monitoreo:          this.tipoMonitoreo,
      responsable:             this.responsable,
      valores_evaluacion:      this.valoresEvaluacion,
      incidencia_pct:          this.incidenciaPct,
      severidad_pct:           this.severidadPct,
      humedad_pct:             this.humedadPct,
      temperatura_c:           this.temperaturaC,
      plagas_detectadas:       this.plagasDetectadas,
      enfermedades_detectadas: this.enfermedadesDetectadas,
      observaciones:           this.observaciones,
      estado_sanitario:        this.estadoSanitario,
      user_id:                 userId
    };
  }
}

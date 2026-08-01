/**
 * EvaluationLegacyAdapter
 * ========================
 * Adaptador de compatibilidad para evaluaciones guardadas con la arquitectura
 * legacy (sin evaluation_snapshots relacionales).
 *
 * Permite que el reporte y la vista de detalle funcionen correctamente
 * tanto para evaluaciones antiguas (solo valores_evaluacion JSONB en monitoreos)
 * como para las nuevas con snapshot relacional completo.
 *
 * Garantiza zero-downtime: el sistema puede mostrar evaluaciones de ambas versiones
 * sin cambios en los componentes de presentación.
 */
export class EvaluationLegacyAdapter {
  /**
   * Transforma una evaluación del formato unificado de reporte.
   * Si la evaluación tiene evaluation_snapshots (v2), usa esos datos.
   * Si no, construye una representación equivalente desde los datos legacy.
   *
   * @param {Object} rawEvaluation - Registro de monitoreos con joins
   * @param {Object|null} snapshot - Dato de evaluation_snapshots (puede ser null si es legacy)
   * @returns {UnifiedEvaluationReport}
   */
  static toUnifiedReport(rawEvaluation, snapshot = null) {
    if (!rawEvaluation) return null;

    const isV2 = !!snapshot;

    return {
      // ── Identificación
      id:           rawEvaluation.id,
      version:      isV2 ? 'v2' : 'legacy',

      // ── Información general
      general: {
        responsable:    rawEvaluation.responsable || '—',
        fecha:          rawEvaluation.fecha_monitoreo,
        loteId:         rawEvaluation.lote_id,
        cultivo:        rawEvaluation.lote?.cultivo || rawEvaluation.lote?.cultivo_ref?.nombre_comun || '—',
        companyId:      rawEvaluation.company_id
      },

      // ── Protocolo utilizado (inmutable si es v2, aproximado si es legacy)
      protocol: isV2 ? {
        id:               snapshot.protocol_id,
        name:             snapshot.protocol_name,
        version:          snapshot.protocol_version,
        monitoringType:   snapshot.monitoring_type,
        objectId:         snapshot.evaluation_object_id,
        objectName:       snapshot.evaluation_object_name,
        objectCategory:   snapshot.object_category,
        samplingMethod:   snapshot.sampling_method,
        minimumSample:    snapshot.minimum_sample
      } : {
        id:               rawEvaluation.protocolo_version_id || null,
        name:             rawEvaluation.objeto_evaluacion?.protocolo?.nombre || 'Protocolo desconocido',
        version:          rawEvaluation.objeto_evaluacion?.protocolo?.version || '—',
        monitoringType:   rawEvaluation.tipo_monitoreo || '—',
        objectId:         rawEvaluation.objeto_evaluacion_id,
        objectName:       rawEvaluation.objeto_evaluacion?.nombre_comun || rawEvaluation.plagas_detectadas || rawEvaluation.enfermedades_detectadas || '—',
        objectCategory:   rawEvaluation.objeto_evaluacion?.categoria || rawEvaluation.tipo_monitoreo || '—',
        samplingMethod:   null,
        minimumSample:    null
      },

      // ── Resultados
      results: {
        incidencePct:   isV2 ? snapshot.incidence_pct : (rawEvaluation.incidencia_pct || 0),
        severityPct:    isV2 ? snapshot.severity_pct  : (rawEvaluation.severidad_pct  || 0),
        coveragePct:    isV2 ? snapshot.coverage_pct  : null,
        riskLevel:      isV2 ? snapshot.risk_level    : EvaluationLegacyAdapter._inferRiskLevel(rawEvaluation.incidencia_pct),
        estadoSanitario: rawEvaluation.estado_sanitario || 'excelente'
      },

      // ── Variables capturadas
      variables: isV2
        // v2: datos relacionales inmutables con interpretación de escalas
        ? (snapshot._variables || []).map(v => ({
            clave:         v.variable_clave,
            etiqueta:      v.etiqueta,
            tipo:          v.tipo,
            unidad:        v.unidad,
            valorCapturado: v.valor_capturado,
            interpretacion: v.interpretacion,
            escalaNivel:   v.escala_nivel,
            escalaColor:   v.escala_color
          }))
        // Legacy: reconstruir desde el JSONB valores_evaluacion (sin metadatos)
        : Object.entries(rawEvaluation.valores_evaluacion || {}).map(([clave, valor]) => ({
            clave,
            etiqueta:      EvaluationLegacyAdapter._humanize(clave),
            tipo:          typeof valor === 'boolean' ? 'Booleano' : 'Texto',
            unidad:        null,
            valorCapturado: String(valor),
            interpretacion: null,
            escalaNivel:   null,
            escalaColor:   null
          })),

      // ── Alertas
      alerts: isV2
        ? (snapshot._alerts || []).map(a => ({
            nivelRiesgo:     a.nivel_riesgo,
            prioridad:       a.prioridad,
            mensaje:         a.mensaje,
            variableClave:   a.variable_clave,
            valorDisparador: a.valor_disparador,
            fechaDisparo:    a.fecha_disparo
          }))
        : EvaluationLegacyAdapter._inferAlertsFromLegacy(rawEvaluation),

      // ── Umbrales
      thresholds: isV2
        ? (snapshot._thresholds || []).map(t => ({
            variableClave:  t.variable_clave,
            operador:       t.operador,
            valorUmbral:    t.valor_umbral,
            nivelRiesgo:    t.nivel_riesgo,
            mensaje:        t.mensaje,
            valorObtenido:  t.valor_obtenido,
            fueSuperado:    t.fue_superado
          }))
        : [],

      // ── Recomendaciones
      recommendations: isV2
        ? (snapshot._recommendations || []).map(r => ({
            categoria: r.categoria,
            mensaje:   r.mensaje,
            prioridad: r.prioridad
          }))
        : EvaluationLegacyAdapter._inferRecommendationsFromLegacy(rawEvaluation),

      // ── Bitácora de eventos (solo v2)
      events: isV2 ? (snapshot._events || []) : [],

      // ── Metadatos
      observaciones: rawEvaluation.observaciones || '',
      evaluationStatus: rawEvaluation.evaluation_status || (isV2 ? 'CONSOLIDADA' : 'CERRADA'),
      createdAt: rawEvaluation.created_at
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILIDADES PRIVADAS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Infiere el nivel de riesgo desde la incidencia en evaluaciones legacy.
   */
  static _inferRiskLevel(incidenciaPct) {
    const i = parseFloat(incidenciaPct) || 0;
    if (i > 30) return 'Crítico';
    if (i > 15) return 'Alto';
    if (i > 5)  return 'Medio';
    if (i > 0)  return 'Bajo';
    return 'Sin riesgo';
  }

  /**
   * Infiere alertas básicas desde datos legacy cuando no hay snapshot.
   */
  static _inferAlertsFromLegacy(evaluation) {
    const alerts = [];
    const inc = parseFloat(evaluation.incidencia_pct) || 0;
    const sev = parseFloat(evaluation.severidad_pct)  || 0;
    const riskLevel = EvaluationLegacyAdapter._inferRiskLevel(inc);

    if (inc > 0) {
      alerts.push({
        nivelRiesgo:     riskLevel,
        prioridad:       riskLevel === 'Crítico' || riskLevel === 'Alto' ? 'Alta' : 'Media',
        mensaje:         `Incidencia detectada: ${inc}% (Dato migrado desde evaluación legacy)`,
        variableClave:   'incidencia_pct',
        valorDisparador: String(inc),
        fechaDisparo:    evaluation.created_at
      });
    }
    if (sev > 25) {
      alerts.push({
        nivelRiesgo:     'Alto',
        prioridad:       'Alta',
        mensaje:         `Severidad elevada: ${sev}% (Dato migrado desde evaluación legacy)`,
        variableClave:   'severidad_pct',
        valorDisparador: String(sev),
        fechaDisparo:    evaluation.created_at
      });
    }
    return alerts;
  }

  /**
   * Infiere recomendaciones básicas en evaluaciones legacy.
   */
  static _inferRecommendationsFromLegacy(evaluation) {
    const recs = [];
    const riskLevel = EvaluationLegacyAdapter._inferRiskLevel(evaluation.incidencia_pct);
    const msgs = {
      'Crítico': 'Se requiere intervención fitosanitaria inmediata según los datos históricos registrados.',
      'Alto':    'Se recomienda incrementar la frecuencia de monitoreo según los datos históricos.',
      'Medio':   'Mantener observación y revisar en el próximo ciclo de monitoreo.',
      'Bajo':    'Continuar con monitoreo preventivo rutinario.',
      'Sin riesgo': 'Sin hallazgos registrados en esta evaluación.'
    };
    if (msgs[riskLevel]) {
      recs.push({ categoria: 'Historial', mensaje: msgs[riskLevel], prioridad: 'Media' });
    }
    if (evaluation.observaciones) {
      recs.push({ categoria: 'Observaciones de campo', mensaje: evaluation.observaciones, prioridad: 'Baja' });
    }
    return recs;
  }

  /**
   * Convierte una clave técnica en una etiqueta legible para humanos.
   * Ej: "frutos_enfermos" → "Frutos Enfermos"
   */
  static _humanize(clave) {
    return (clave || '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}

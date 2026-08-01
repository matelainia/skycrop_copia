/**
 * ProtocolCalculationEngine
 * =========================
 * VERSIÓN 2.0 — Adaptador sobre EvaluationPipeline.
 *
 * CAMBIO ARQUITECTÓNICO:
 *   Esta clase ya NO contiene lógica de cálculo propia.
 *   Actúa como adaptador entre la interfaz de usuario existente
 *   y el nuevo EvaluationPipeline, garantizando cero ruptura de contrato.
 *
 * MIGRACIÓN:
 *   - Antes: lógica hardcodeada para incidencia, severidad, escalas
 *   - Ahora: delega TODO al pipeline basado en configuración del protocolo
 *
 * COMPATIBILIDAD:
 *   El método `compute()` retorna el mismo objeto de salida que la versión
 *   anterior más los nuevos campos del pipeline (indicadores, alertas, etc.).
 *   Cualquier consumidor de la versión anterior seguirá funcionando sin cambios.
 *
 * MÉTODOS UTILITARIOS PRESERVADOS:
 *   - calculateCoverage()      → sin cambios
 *   - calculateEvaluatedArea() → sin cambios
 *   Los demás métodos calculadores directos (calculateIncidence, etc.)
 *   ya no son el camino principal; se mantienen como fallback para compatibilidad.
 */

import { EvaluationPipeline } from './EvaluationPipeline.js';

export class ProtocolCalculationEngine {

  /**
   * Ejecuta todos los cálculos sobre los valores capturados y el protocolo.
   * Ahora delega al EvaluationPipeline.
   *
   * @param {Object} protocolDefinition — Definición completa del protocolo
   * @param {Object} capturedValues     — { [clave]: value } valores ingresados por el evaluador
   * @param {Object} loteMetadata       — { area_ha, cultivo, codigo_interno, ... }
   * @param {Object} [contexto]         — Contexto agronómico opcional
   * @returns {CalculationResult}       — Resultado compatible con la interfaz anterior + nuevos campos
   */
  static compute(protocolDefinition, capturedValues, loteMetadata = {}, contexto = {}) {
    const variables      = protocolDefinition?.variables || [];
    const minimumSample  = protocolDefinition?.tamanio_muestra || 100;
    const areaLote       = loteMetadata?.area_ha || 0;

    // ── Puntos evaluados (tomados del campo especial o calculados)
    const puntosEvaluados = Math.max(0,
      parseFloat(capturedValues?.puntos_evaluados
        ?? capturedValues?.plantas_evaluadas
        ?? capturedValues?.frutos_evaluados ?? 0)
    );

    // ── Cobertura de muestreo (no cambia, es función utilitaria pura)
    const coveragePct    = ProtocolCalculationEngine.calculateCoverage(puntosEvaluados, minimumSample);
    const evaluatedArea  = ProtocolCalculationEngine.calculateEvaluatedArea(areaLote, puntosEvaluados, minimumSample);

    // ── DELEGAR AL PIPELINE (cálculo de indicadores, escalas, alertas)
    const pipelineResult = EvaluationPipeline.runLive(
      protocolDefinition,
      capturedValues,
      contexto
    );

    // Fallback de Incidencia y Severidad si el pipeline no retorna un valor > 0
    let incidencePct = pipelineResult.incidencia_pct;
    if (!incidencePct || incidencePct === 0) {
      incidencePct = ProtocolCalculationEngine.calculateIncidence(capturedValues, variables, puntosEvaluados);
    }

    let severityPct = pipelineResult.severidad_pct;
    if (!severityPct || severityPct === 0) {
      severityPct = ProtocolCalculationEngine.calculateSeverity(capturedValues, variables);
    }

    // ── Variables completadas vs. pendientes (UI helper — sin cambios)
    const { completed, pending } = ProtocolCalculationEngine.countCompletedVariables(capturedValues, variables);

    // ── Métricas por variable (para widgets de progreso — sin cambios)
    const variableMetrics = ProtocolCalculationEngine.computeVariableMetrics(capturedValues, variables);

    // ── Interpretación de escalas por variable (para colorear campos)
    const scaleInterpretations = ProtocolCalculationEngine.interpretScales(capturedValues, variables);

    return {
      // ── Campos de compatibilidad (API pública sin cambios)
      coveragePct,
      incidencePct,
      severityPct,
      evaluatedArea,
      puntosEvaluados,
      minimumSample,
      variableMetrics,
      completedVariables: completed,
      pendingVariables:   pending,
      scaleInterpretations,
      capturedValues,
      areaLote,

      // ── Nuevos campos del pipeline (Versión 2.0)
      indicadores:        pipelineResult.indicadores,
      alertas:            pipelineResult.alertas,
      recomendaciones:    pipelineResult.recomendaciones,
      riesgoGlobal:       pipelineResult.riesgoGlobal,
      pipelineMetadata:   pipelineResult.metadata,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MÉTODOS UTILITARIOS — preservados sin cambios para compatibilidad
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Calcula el porcentaje de cobertura del muestreo.
   */
  static calculateCoverage(evaluated, planned) {
    if (!planned || planned <= 0) return 0;
    const e = Math.max(0, parseFloat(evaluated) || 0);
    const p = Math.max(1, parseFloat(planned));
    return parseFloat(Math.min(100, (e / p) * 100).toFixed(1));
  }

  /**
   * Calcula el área evaluada en hectáreas.
   */
  static calculateEvaluatedArea(areaTotal, evaluated, planned) {
    if (!areaTotal || !planned) return 0;
    const e = Math.max(0, parseFloat(evaluated) || 0);
    const p = Math.max(1, parseFloat(planned));
    return parseFloat(Math.min(areaTotal, areaTotal * (e / p)).toFixed(2));
  }

  /**
   * Cuenta variables completadas y pendientes.
   */
  static countCompletedVariables(values, variables) {
    if (!variables?.length) return { completed: 0, pending: [] };
    let completed = 0;
    const pending = [];

    for (const variable of variables) {
      const val = values?.[variable.clave];
      const isEmpty = val === undefined || val === null || val === '';
      if (!isEmpty) {
        completed++;
      } else {
        pending.push({ clave: variable.clave, etiqueta: variable.etiqueta, obligatorio: variable.obligatorio !== false });
      }
    }

    return { completed, pending };
  }

  /**
   * Calcula métricas derivadas por variable (suma, promedio, porcentaje del máximo).
   */
  static computeVariableMetrics(values, variables) {
    const metrics = {};
    if (!values || !variables?.length) return metrics;

    const numericVars = variables.filter(v => ['Número', 'Decimal', 'number'].includes(v.tipo));
    for (const variable of numericVars) {
      const raw = values[variable.clave];
      if (raw === undefined || raw === null || raw === '') continue;
      const num = parseFloat(raw);
      if (isNaN(num)) continue;

      const max = variable.max_valor ?? null;
      metrics[variable.clave] = {
        value: num,
        sum:   num,
        avg:   num,
        pct:   max ? parseFloat(Math.min(100, (num / max) * 100).toFixed(2)) : null
      };
    }
    return metrics;
  }

  /**
   * Interpreta el nivel de escala de color para cada variable.
   * Usado por la UI para colorear campos del formulario de evaluación.
   */
  static interpretScales(values, variables) {
    const interpretations = {};
    if (!values || !variables?.length) return interpretations;

    for (const variable of variables) {
      if (!variable.escalas?.length) continue;
      const raw = values[variable.clave];
      if (raw === undefined || raw === null || raw === '') continue;
      const num = parseFloat(raw);
      if (isNaN(num)) continue;

      for (const escala of variable.escalas) {
        const min = escala.min_val !== null && escala.min_val !== undefined ? escala.min_val : -Infinity;
        const max = escala.max_val !== null && escala.max_val !== undefined ? escala.max_val : Infinity;
        if (num >= min && num < max) {
          interpretations[variable.clave] = {
            nivel:    escala.nivel,
            color:    escala.color,
            bg_color: escala.bg_color
          };
          break;
        }
      }
    }

    return interpretations;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MÉTODOS DE FALLBACK — Calculadores automáticos inteligentes
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Calcula la incidencia automáticamente mediante detección inteligente de variables
   * o fórmula (afectados / total) * 100.
   */
  static calculateIncidence(values, variables = [], puntosEvaluados = 0) {
    if (!values) return 0;

    // 1. Claves directas de incidencia
    const directKeys = ['incidencia_pct', 'incidencia', 'porcentaje_incidencia', 'nivel_incidencia', 'pct_incidencia'];
    for (const key of directKeys) {
      const val = values[key];
      if (val !== undefined && val !== null && val !== '') {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) return parseFloat(Math.min(100, n).toFixed(2));
      }
    }

    // 2. Variables de protocolo con unidad '%' o 'incidencia' en la clave
    for (const variable of (variables || [])) {
      if (variable.unidad === '%' || variable.clave?.toLowerCase().includes('incidencia')) {
        const raw = values[variable.clave];
        if (raw !== undefined && raw !== null && raw !== '') {
          const n = parseFloat(raw);
          if (!isNaN(n) && n > 0) return parseFloat(Math.min(100, n).toFixed(2));
        }
      }
    }

    // 3. Denominador (total evaluado)
    const totalKeys = [
      'total_de_mazorcas', 'total_mazorcas', 'total_muestras', 'total_evaluado',
      'frutos_evaluados', 'hojas_evaluadas', 'mazorcas_evaluadas', 'muestras_totales',
      'n_evaluado', 'plantas_evaluadas', 'puntos_evaluados', 'tamanio_muestra'
    ];
    const explicitTotal = ProtocolCalculationEngine._findNumericValue(values, [
      'total_de_mazorcas', 'total_mazorcas', 'total_muestras', 'total_evaluado',
      'frutos_evaluados', 'mazorcas_evaluadas', 'muestras_totales'
    ]);
    const totalSample = explicitTotal > 0
      ? explicitTotal
      : (puntosEvaluados > 0 ? puntosEvaluados : ProtocolCalculationEngine._findNumericValue(values, totalKeys));

    // 4. Numerador (total afectado / enfermo)
    const affectedKeys = [
      'frutos_enfermos', 'plantas_afectadas', 'hojas_infectadas',
      'mazorcas_enfermas', 'mazorcas_barrenadas', 'puntos_afectados', 'muestras_afectadas',
      'total_afectado', 'n_afectado', 'frutos_brocados', 'plantas_con_sintomas',
      'frutos_danados', 'plantas_enfermas', 'dano_frutos', 'conteo_afectadas',
      'afectados', 'hallazgos', 'incidencias', 'num_afectados', 'casos_detectados'
    ];
    let affected = ProtocolCalculationEngine._findNumericValue(values, affectedKeys);

    // 5. Fallback si tenemos total y sanas -> afectadas = total - sanas
    if (affected === 0 && totalSample > 0) {
      const healthyKeys = ['mazorcas_sanas', 'frutos_sanos', 'plantas_sanas', 'hojas_sanas'];
      const healthy = ProtocolCalculationEngine._findNumericValue(values, healthyKeys);
      if (healthy > 0 && healthy < totalSample) {
        affected = totalSample - healthy;
      }
    }

    if (totalSample > 0 && affected > 0) {
      return parseFloat(Math.min(100, (affected / totalSample) * 100).toFixed(2));
    }

    // 6. Fallback general sobre cualquier variable numérica < totalSample
    if (totalSample > 0) {
      for (const [key, raw] of Object.entries(values)) {
        const kLower = key.toLowerCase();
        if (kLower === 'puntos_evaluados' || totalKeys.includes(kLower)) continue;
        const num = parseFloat(raw);
        if (!isNaN(num) && num > 0 && num < totalSample) {
          return parseFloat(Math.min(100, (num / totalSample) * 100).toFixed(2));
        }
      }
    }

  }

  /**
   * @deprecated Usar EvaluationPipeline.run() → indicadores[].valor en su lugar.
   */
  static calculateSeverity(values, variables) {
    if (!values) return 0;
    const directKeys = ['severidad_pct', 'severidad_visual', 'severidad'];
    const directVal  = ProtocolCalculationEngine._findNumericValue(values, directKeys);
    if (directVal > 0) return parseFloat(Math.min(100, directVal).toFixed(2));
    return 0;
  }

  static _findNumericValue(values, candidates) {
    if (!values) return 0;
    for (const key of candidates) {
      const val = values[key];
      if (val !== undefined && val !== null && val !== '') {
        const n = parseFloat(val);
        if (!isNaN(n)) return n;
      }
    }
    return 0;
  }
}

/**
 * ProtocolRuleEngine
 * ==================
 * Motor de evaluación de reglas y umbrales PURO — sin dependencias de React ni UI.
 * Consume los resultados calculados por ProtocolCalculationEngine para:
 *   - Evaluar reglas SI/ENTONCES del protocolo
 *   - Evaluar umbrales de alerta
 *   - Generar alertas con nivel de riesgo y prioridad
 *   - Generar recomendaciones agronómicas dinámicas
 *   - Calcular el nivel de riesgo global de la evaluación
 *
 * Operadores soportados:
 *   Comparadores:     >  <  >=  <=  ==  !=  BETWEEN
 *   Lógicos:          AND  OR  NOT
 *   Funciones:        SUM  AVG  %   (procesadas por ProtocolCalculationEngine)
 *
 * Niveles de riesgo: Sin riesgo | Bajo | Medio | Alto | Crítico
 */

const RISK_ORDER = { 'Sin riesgo': 0, Bajo: 1, Medio: 2, Alto: 3, Crítico: 4 };

export class ProtocolRuleEngine {

  /**
   * Evalúa el protocolo completo en base a los valores calculados y capturados.
   *
   * @param {Object} protocolDefinition - Definición completa del protocolo (reglas, umbrales)
   * @param {Object} calculationResult  - Resultado de ProtocolCalculationEngine.compute()
   * @param {Object} capturedValues     - Valores crudos capturados por el evaluador
   * @returns {EvaluationResult}
   */
  static evaluate(protocolDefinition, calculationResult, capturedValues = {}) {
    const umbrales  = protocolDefinition?.umbrales || [];
    const reglas    = protocolDefinition?.reglas   || [];

    const triggeredAlerts = [];
    const firedRules      = [];

    // ── 1. EVALUAR UMBRALES ────────────────────────────────────────────────
    for (const umbral of umbrales) {
      if (!umbral.activo && umbral.activo !== undefined) continue;

      const variableValue = ProtocolRuleEngine._resolveValue(
        capturedValues,
        calculationResult,
        umbral.variable_clave
      );

      const wasSurpassed = ProtocolRuleEngine._compare(
        variableValue,
        umbral.operador,
        parseFloat(umbral.valor)
      );

      if (wasSurpassed) {
        triggeredAlerts.push({
          nivel_riesgo:    umbral.nivel_riesgo,
          prioridad:       ProtocolRuleEngine._riskToPriority(umbral.nivel_riesgo),
          mensaje:         umbral.mensaje || ProtocolRuleEngine._buildThresholdMessage(umbral, variableValue),
          variable_clave:  umbral.variable_clave,
          valor_disparador: String(variableValue),
          // Para el snapshot
          fue_superado:    true,
          valor_obtenido:  variableValue,
          valor_umbral:    parseFloat(umbral.valor),
          operador:        umbral.operador
        });
      }
    }

    // ── 2. EVALUAR REGLAS SI/ENTONCES ─────────────────────────────────────
    for (const regla of reglas) {
      if (!regla.activo && regla.activo !== undefined) continue;

      const variableValue = ProtocolRuleEngine._resolveValue(
        capturedValues,
        calculationResult,
        regla.variable_clave
      );

      const conditionMet = ProtocolRuleEngine._compare(
        variableValue,
        regla.operador,
        ProtocolRuleEngine._parseRuleValue(regla.valor)
      );

      if (conditionMet) {
        firedRules.push({
          ...regla,
          fue_disparada:    true,
          valor_disparador: String(variableValue)
        });

        // Si la acción es "Crear alerta", agregar alerta al listado
        if (regla.accion === 'Crear alerta' || regla.accion === 'Recomendar intervención') {
          // Evitar duplicados de alertas si ya fue disparado por umbral
          const isDuplicate = triggeredAlerts.some(a =>
            a.variable_clave === regla.variable_clave &&
            a.mensaje === regla.mensaje
          );
          if (!isDuplicate && regla.mensaje) {
            triggeredAlerts.push({
              nivel_riesgo:    ProtocolRuleEngine._actionToRisk(regla.accion),
              prioridad:       'Alta',
              mensaje:         regla.mensaje,
              variable_clave:  regla.variable_clave,
              valor_disparador: String(variableValue),
              fue_superado:    true,
              valor_obtenido:  variableValue
            });
          }
        }
      } else {
        firedRules.push({ ...regla, fue_disparada: false });
      }
    }

    // ── 3. NIVEL DE RIESGO GLOBAL ─────────────────────────────────────────
    const globalRiskLevel = ProtocolRuleEngine._calculateGlobalRisk(
      triggeredAlerts,
      calculationResult.incidencePct,
      calculationResult.severityPct
    );

    // ── 4. RECOMENDACIONES DINÁMICAS ──────────────────────────────────────
    const recommendations = ProtocolRuleEngine._generateRecommendations(
      globalRiskLevel,
      calculationResult,
      triggeredAlerts
    );

    // ── 5. UMBRALES ENRIQUECIDOS (con valor real para el snapshot) ────────
    const enrichedThresholds = umbrales.map(u => ({
      variable_clave: u.variable_clave,
      operador:       u.operador,
      valor_umbral:   parseFloat(u.valor),
      nivel_riesgo:   u.nivel_riesgo,
      mensaje:        u.mensaje || '',
      valor_obtenido: ProtocolRuleEngine._resolveValue(capturedValues, calculationResult, u.variable_clave),
      fue_superado:   triggeredAlerts.some(a => a.variable_clave === u.variable_clave)
    }));

    return {
      alerts:           triggeredAlerts,
      firedRules,
      enrichedThresholds,
      recommendations,
      globalRiskLevel,
      hasAlerts:        triggeredAlerts.length > 0,
      alertCount:       triggeredAlerts.length,
      criticalCount:    triggeredAlerts.filter(a => a.nivel_riesgo === 'Crítico').length,
      highCount:        triggeredAlerts.filter(a => a.nivel_riesgo === 'Alto').length
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EVALUACIÓN COMPUESTA DE MÚLTIPLES CONDICIONES (AND / OR / NOT)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Evalúa una condición compuesta con soporte para AND / OR / NOT.
   * @param {Array} conditions - [{ variable_clave, operador, valor, logico }]
   * @param {Object} values    - Valores capturados
   * @param {Object} calcResult - Resultado de cálculo
   * @returns {boolean}
   */
  static evaluateComposite(conditions, values, calcResult) {
    if (!conditions?.length) return false;
    if (conditions.length === 1) {
      return ProtocolRuleEngine._evaluateSingle(conditions[0], values, calcResult);
    }

    // Determinar el operador lógico del grupo (por defecto AND)
    const logicalOp = conditions[0]?.operador_logico?.toUpperCase() || 'AND';
    const results   = conditions.map(c =>
      ProtocolRuleEngine._evaluateSingle(c, values, calcResult)
    );

    switch (logicalOp) {
      case 'AND':   return results.every(Boolean);
      case 'OR':    return results.some(Boolean);
      case 'NOT':   return !results[0];
      default:      return results.every(Boolean);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UTILIDADES INTERNAS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Evalúa una sola condición.
   */
  static _evaluateSingle(condition, values, calcResult) {
    const v = ProtocolRuleEngine._resolveValue(values, calcResult, condition.variable_clave);
    const target = ProtocolRuleEngine._parseRuleValue(condition.valor);

    if (condition.operador?.toUpperCase() === 'NOT') {
      return !ProtocolRuleEngine._compare(v, '==', target);
    }
    return ProtocolRuleEngine._compare(v, condition.operador, target);
  }

  /**
   * Compara un valor con un operador y un objetivo.
   * @param {number|string} value    - Valor a comparar
   * @param {string}        operator - Operador: >, <, >=, <=, ==, !=, BETWEEN
   * @param {number|string} target   - Valor objetivo
   * @param {number}        [target2] - Segundo valor para BETWEEN
   * @returns {boolean}
   */
  static _compare(value, operator, target, target2 = null) {
    const v  = parseFloat(value);
    const t  = parseFloat(target);

    // Si alguno no es numérico, comparar como string
    if (isNaN(v) || isNaN(t)) {
      const vs = String(value ?? '').trim().toLowerCase();
      const ts = String(target ?? '').trim().toLowerCase();
      switch (operator) {
        case '==': case '=': return vs === ts;
        case '!=':           return vs !== ts;
        default:             return false;
      }
    }

    switch (operator) {
      case '>':       return v > t;
      case '<':       return v < t;
      case '>=':      return v >= t;
      case '<=':      return v <= t;
      case '==':
      case '=':       return v === t;
      case '!=':      return v !== t;
      case 'BETWEEN': {
        const t2 = parseFloat(target2);
        return !isNaN(t2) ? (v >= t && v <= t2) : false;
      }
      default:        return false;
    }
  }

  /**
   * Resuelve el valor de una variable, buscando primero en los valores capturados
   * y como fallback en las métricas calculadas (incidencia, severidad, cobertura).
   */
  static _resolveValue(capturedValues, calcResult, clave) {
    if (!clave) return 0;
    // Atajos para métricas calculadas
    const virtualKeys = {
      'incidencia_pct':  calcResult?.incidencePct  ?? 0,
      'incidencia':      calcResult?.incidencePct  ?? 0,
      'severidad_pct':   calcResult?.severityPct   ?? 0,
      'severidad':       calcResult?.severityPct   ?? 0,
      'cobertura_pct':   calcResult?.coveragePct   ?? 0,
      'cobertura':       calcResult?.coveragePct   ?? 0,
      'area_evaluada':   calcResult?.evaluatedArea ?? 0
    };
    if (clave in virtualKeys) return virtualKeys[clave];

    const raw = capturedValues?.[clave];
    if (raw === undefined || raw === null || raw === '') return 0;
    const n = parseFloat(raw);
    return isNaN(n) ? raw : n;
  }

  /**
   * Parsea el valor de una regla: intenta numérico, sino devuelve string.
   */
  static _parseRuleValue(val) {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(val);
    return isNaN(n) ? String(val).trim().toLowerCase() : n;
  }

  /**
   * Convierte el nivel de riesgo a prioridad de alerta.
   */
  static _riskToPriority(riskLevel) {
    return { Bajo: 'Baja', Medio: 'Media', Alto: 'Alta', Crítico: 'Crítica' }[riskLevel] || 'Media';
  }

  /**
   * Mapea tipo de acción de regla a nivel de riesgo.
   */
  static _actionToRisk(accion) {
    if (accion === 'Recomendar intervención') return 'Alto';
    if (accion === 'Crear alerta') return 'Medio';
    return 'Medio';
  }

  /**
   * Calcula el nivel de riesgo global de la evaluación.
   * El nivel más alto de las alertas disparadas determina el global.
   * Se combina con incidencia/severidad calculada.
   */
  static _calculateGlobalRisk(alerts, incidencePct, severityPct) {
    let maxRisk = 0;

    // Desde alertas disparadas
    for (const alert of alerts) {
      const r = RISK_ORDER[alert.nivel_riesgo] ?? 0;
      if (r > maxRisk) maxRisk = r;
    }

    // Fallback por incidencia/severidad si no hay alertas configuradas
    if (alerts.length === 0) {
      if (incidencePct > 30 || severityPct > 50) maxRisk = Math.max(maxRisk, RISK_ORDER['Crítico']);
      else if (incidencePct > 15 || severityPct > 25) maxRisk = Math.max(maxRisk, RISK_ORDER['Alto']);
      else if (incidencePct > 5  || severityPct > 10) maxRisk = Math.max(maxRisk, RISK_ORDER['Medio']);
      else if (incidencePct > 0  || severityPct > 0)  maxRisk = Math.max(maxRisk, RISK_ORDER['Bajo']);
    }

    return Object.entries(RISK_ORDER).find(([, v]) => v === maxRisk)?.[0] || 'Sin riesgo';
  }

  /**
   * Genera recomendaciones agronómicas dinámicas basadas en los resultados.
   */
  static _generateRecommendations(riskLevel, calcResult, alerts) {
    const recs = [];
    const { coveragePct, incidencePct, minimumSample, puntosEvaluados } = calcResult;

    // Recomendación de cobertura
    if (coveragePct < 80) {
      const faltantes = Math.max(1, minimumSample - puntosEvaluados);
      recs.push({
        categoria: 'Cobertura',
        mensaje:   `Cobertura insuficiente (${coveragePct}%). Evaluar ${faltantes} puntos adicionales para cumplir con el protocolo.`,
        prioridad: 'Alta'
      });
    }

    // Recomendaciones según nivel de riesgo
    switch (riskLevel) {
      case 'Crítico':
        recs.push({
          categoria: 'Intervención urgente',
          mensaje:   `Nivel de riesgo CRÍTICO (Incidencia: ${incidencePct}%). Se requiere intervención fitosanitaria inmediata y coordinación con el equipo técnico.`,
          prioridad: 'Crítica'
        });
        break;
      case 'Alto':
        recs.push({
          categoria: 'Seguimiento intensivo',
          mensaje:   `Incidencia alta (${incidencePct}%). Incrementar frecuencia de monitoreo y evaluar aplicación de tratamiento.`,
          prioridad: 'Alta'
        });
        break;
      case 'Medio':
        recs.push({
          categoria: 'Monitoreo preventivo',
          mensaje:   `Incidencia moderada (${incidencePct}%). Mantener observación y revisar en 7 días.`,
          prioridad: 'Media'
        });
        break;
      case 'Bajo':
        recs.push({
          categoria: 'Control rutinario',
          mensaje:   `Bajo nivel de hallazgos (${incidencePct}%). Continuar con monitoreo preventivo según calendario.`,
          prioridad: 'Baja'
        });
        break;
      default:
        if (incidencePct === 0 && coveragePct >= 80) {
          recs.push({
            categoria: 'Sin hallazgos',
            mensaje:   'No se detectaron hallazgos en la evaluación. Mantener rutina de monitoreo.',
            prioridad: 'Baja'
          });
        }
        break;
    }

    // Agregar mensajes de alertas disparadas como recomendaciones adicionales
    for (const alert of alerts) {
      if (alert.nivel_riesgo === 'Crítico' || alert.nivel_riesgo === 'Alto') {
        recs.push({
          categoria: `Alerta ${alert.nivel_riesgo}`,
          mensaje:   alert.mensaje,
          prioridad: alert.prioridad
        });
      }
    }

    return recs;
  }

  /**
   * Genera un mensaje descriptivo para un umbral superado.
   */
  static _buildThresholdMessage(umbral, valor) {
    return `Variable "${umbral.variable_clave}": valor ${valor} ${umbral.operador} ${umbral.valor} (umbral ${umbral.nivel_riesgo})`;
  }
}

/**
 * AlertEngine
 * ===========
 * Paso 4 del pipeline de evaluación.
 *
 * Responsabilidad:
 *   Evaluar las reglas de alerta/umbral definidas en el protocolo contra
 *   los indicadores ya calculados y clasificados.
 *
 * TIPOS DE REGLAS EVALUADAS:
 *   1. Umbrales simples:      variable > valor   → disparar alerta
 *   2. Reglas SI/ENTONCES:    IF condición THEN acción  (reglas compuestas)
 *   3. Reglas de nivel:       Si clasificación.nivel == 'Crítico' → disparar
 *
 * OPERADORES SOPORTADOS: > < >= <= == != BETWEEN
 *
 * JERARQUÍA DE PRIORIDAD DE ALERTAS:
 *   Sin riesgo (0) → Bajo (1) → Medio (2) → Alto (3) → Crítico (4)
 *
 * FUENTE DE VERDAD:
 *   Todas las reglas vienen EXCLUSIVAMENTE del protocolo.
 *   AlertEngine no tiene lógica hardcodeada sobre qué variable dispara qué alerta.
 */

import { ScaleEngine } from './ScaleEngine.js';

const PRIORITY_MAP = { 'Sin riesgo': 0, Bajo: 1, Medio: 2, Alto: 3, Crítico: 4, Critico: 4 };

export class AlertEngine {

  /**
   * Evalúa todas las reglas de alerta del protocolo.
   *
   * @param {Object} protocolo             — Definición completa del protocolo
   * @param {Array}  indicadoresClasificados — Salida de ScaleEngine.classifyAll()
   * @param {Object} dictionary            — Diccionario de variables + indicadores calculados
   * @returns {{ alertas: Alert[], riesgoGlobal: GlobalRisk }}
   */
  static evaluate(protocolo, indicadoresClasificados = [], dictionary = {}) {
    const umbrales = protocolo?.umbrales || [];
    const reglas   = protocolo?.reglas   || [];

    const alertas = [];

    // Mapa de indicadores calculados para acceso rápido
    const indMap = new Map(indicadoresClasificados.map(i => [i.clave, i]));

    // ── PASO 1: Evaluar Umbrales ─────────────────────────────────────────────
    for (const umbral of umbrales) {
      if (umbral.activo === false) continue;

      const valor = AlertEngine._resolveValue(umbral.variable_clave, indMap, dictionary);
      if (valor === null) continue;

      const disparado = AlertEngine._compare(valor, umbral.operador, parseFloat(umbral.valor));
      if (!disparado) continue;

      alertas.push({
        tipo:            'umbral',
        nivel_riesgo:    umbral.nivel_riesgo || 'Medio',
        prioridad:       PRIORITY_MAP[umbral.nivel_riesgo] ?? 2,
        mensaje:         umbral.mensaje || AlertEngine._buildAutoMessage(umbral, valor),
        recomendacion:   umbral.recomendacion || null,
        variable_clave:  umbral.variable_clave,
        valor_obtenido:  valor,
        valor_umbral:    parseFloat(umbral.valor),
        operador:        umbral.operador,
        fue_superado:    true,
      });
    }

    // ── PASO 2: Evaluar Reglas SI/ENTONCES ───────────────────────────────────
    for (const regla of reglas) {
      if (regla.activo === false) continue;

      const valor = AlertEngine._resolveValue(regla.variable_clave, indMap, dictionary);
      if (valor === null) continue;

      const cumple = AlertEngine._evaluateCondition(regla, valor, indMap, dictionary);
      if (!cumple) continue;

      alertas.push({
        tipo:           'regla',
        nivel_riesgo:   regla.nivel_riesgo || 'Bajo',
        prioridad:      PRIORITY_MAP[regla.nivel_riesgo] ?? 1,
        mensaje:        regla.mensaje || regla.accion || 'Regla disparada',
        recomendacion:  regla.recomendacion || null,
        variable_clave: regla.variable_clave,
        valor_obtenido: valor,
        accion:         regla.accion || null,
      });
    }

    // ── PASO 3: Alertas por clasificación de escala ──────────────────────────
    for (const ind of indicadoresClasificados) {
      if (!ind.clasificacion) continue;
      const nivel = ind.clasificacion.nivel;
      const prioridad = ScaleEngine.riskLevel(nivel);

      // Solo registrar alertas para niveles Alto o Crítico provenientes de escalas
      if (prioridad >= 3) {
        alertas.push({
          tipo:           'escala',
          nivel_riesgo:   nivel,
          prioridad,
          mensaje:        `${ind.nombre || ind.clave} en nivel ${nivel} (${ind.valor} ${ind.unidad})`,
          recomendacion:  null,
          variable_clave: ind.clave,
          valor_obtenido: ind.valor,
        });
      }
    }

    // ── PASO 4: Calcular riesgo global ────────────────────────────────────────
    const riesgoGlobal = AlertEngine._calcularRiesgoGlobal(indicadoresClasificados, alertas);

    // Ordenar alertas por prioridad descendente
    alertas.sort((a, b) => b.prioridad - a.prioridad);

    return { alertas, riesgoGlobal };
  }

  // ─── UTILIDADES INTERNAS ────────────────────────────────────────────────────

  /**
   * Resuelve el valor de una variable: busca primero en indicadores calculados,
   * luego en el diccionario de variables crudas.
   */
  static _resolveValue(clave, indMap, dictionary) {
    if (!clave) return null;

    // Buscar como indicador calculado (con y sin mayúsculas)
    const ind = indMap.get(clave) || indMap.get(clave.toUpperCase()) || indMap.get(clave.toLowerCase());
    if (ind && ind.valor !== null) return ind.valor;

    // Buscar en diccionario de variables
    const val = dictionary[clave] ?? dictionary[clave.toUpperCase()] ?? dictionary[clave.toLowerCase()];
    if (val !== null && val !== undefined) {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }

    return null;
  }

  /**
   * Evalúa si una condición de regla se cumple.
   * Soporta condiciones simples (variable operador valor) y BETWEEN.
   */
  static _evaluateCondition(regla, valor, indMap, dictionary) {
    // Condición BETWEEN
    if (regla.operador === 'BETWEEN' && regla.valor_min !== undefined && regla.valor_max !== undefined) {
      return valor >= parseFloat(regla.valor_min) && valor <= parseFloat(regla.valor_max);
    }

    // Condición simple
    return AlertEngine._compare(valor, regla.operador, parseFloat(regla.valor));
  }

  /**
   * Compara un valor con un umbral usando el operador dado.
   */
  static _compare(value, operator, threshold) {
    if (isNaN(threshold)) return false;
    switch (operator) {
      case '>':  return value >  threshold;
      case '<':  return value <  threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '=':
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default:   return false;
    }
  }

  /**
   * Genera un mensaje automático cuando el umbral no tiene mensaje personalizado.
   */
  static _buildAutoMessage(umbral, valorActual) {
    return `${umbral.variable_clave} (${valorActual}) ${umbral.operador} ${umbral.valor}`;
  }

  /**
   * Calcula el nivel de riesgo global de la evaluación.
   */
  static _calcularRiesgoGlobal(indicadoresClasificados, alertas) {
    const NIVELES = { 'Sin riesgo': 0, Bajo: 1, Medio: 2, Alto: 3, Crítico: 4, Critico: 4 };

    let nivelMax  = 0;
    let nivelLabel = 'Sin riesgo';
    let color      = '#22c55e';

    // Considerar clasificaciones de indicadores
    for (const ind of indicadoresClasificados) {
      const nivel = NIVELES[ind.clasificacion?.nivel] ?? 0;
      if (nivel > nivelMax) {
        nivelMax   = nivel;
        nivelLabel = ind.clasificacion.nivel;
        color      = ind.clasificacion.color || color;
      }
    }

    // Considerar alertas disparadas
    for (const alerta of alertas) {
      const nivel = PRIORITY_MAP[alerta.nivel_riesgo] ?? 0;
      if (nivel > nivelMax) {
        nivelMax   = nivel;
        nivelLabel = alerta.nivel_riesgo;
      }
    }

    const colorMap = {
      'Sin riesgo': '#22c55e',
      'Bajo':       '#84cc16',
      'Medio':      '#f59e0b',
      'Alto':       '#ef4444',
      'Crítico':    '#7f1d1d',
      'Critico':    '#7f1d1d',
    };

    return {
      nivel:                    nivelLabel,
      color:                    colorMap[nivelLabel] || '#6b7280',
      prioridad:                nivelMax,
      numIndicadoresAlto:       indicadoresClasificados.filter(i => (NIVELES[i.clasificacion?.nivel] ?? 0) >= 3).length,
      numAlertasDisparadas:     alertas.length,
    };
  }
}

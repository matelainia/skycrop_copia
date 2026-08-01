/**
 * RecommendationEngine
 * ====================
 * Paso 5 del pipeline de evaluación.
 *
 * Responsabilidad ÚNICA:
 *   Generar recomendaciones agronómicas EXCLUSIVAMENTE a partir de las
 *   reglas de recomendación definidas en el protocolo.
 *
 * PRINCIPIO:
 *   El protocolo es la fuente de verdad. Este motor NO tiene conocimiento
 *   agronómico propio. Si el protocolo no tiene una recomendación configurada
 *   para un nivel/condición, el motor retorna vacío para ese indicador.
 *
 * FUENTES DE RECOMENDACIONES (en orden de prioridad):
 *   1. Alertas disparadas por AlertEngine que traen recomendación explícita
 *   2. Reglas de recomendación autónomas del protocolo (protocolo.recomendaciones)
 *   3. Niveles de escala que tienen recomendación asociada
 *
 * ESTRUCTURA DE UNA RECOMENDACIÓN:
 *   {
 *     prioridad:   number,       // 0–4 (igual jerarquía que alertas)
 *     nivel_riesgo: string,      // Bajo | Medio | Alto | Crítico
 *     accion:      string,       // Descripción de qué hacer
 *     plazo:       string|null,  // '24h' | '72h' | 'próxima visita' | null
 *     fuente:      string,       // 'alerta' | 'regla' | 'escala' | 'ia_sugerida'
 *     indicador:   string|null,  // Clave del indicador que la generó
 *   }
 */

export class RecommendationEngine {

  /**
   * Genera todas las recomendaciones basadas en el resultado de la evaluación.
   *
   * @param {Object} protocolo             — Definición del protocolo
   * @param {Array}  indicadoresClasificados — Salida de ScaleEngine.classifyAll()
   * @param {Array}  alertas               — Salida de AlertEngine.evaluate().alertas
   * @returns {{ recomendaciones: Recommendation[] }}
   */
  static generate(protocolo, indicadoresClasificados = [], alertas = []) {
    const recomendaciones = [];
    const reglasPropias   = protocolo?.recomendaciones || [];
    const visto           = new Set(); // evitar duplicados

    // ── FUENTE 1: Alertas con recomendación explícita ─────────────────────
    for (const alerta of alertas) {
      if (!alerta.recomendacion) continue;
      const key = `alerta:${alerta.variable_clave}:${alerta.recomendacion}`;
      if (visto.has(key)) continue;
      visto.add(key);

      recomendaciones.push({
        prioridad:    alerta.prioridad,
        nivel_riesgo: alerta.nivel_riesgo,
        accion:       alerta.recomendacion,
        plazo:        alerta.plazo || null,
        fuente:       'alerta',
        indicador:    alerta.variable_clave || null,
      });
    }

    // ── FUENTE 2: Reglas de recomendación autónomas del protocolo ──────────
    const indMap = new Map(indicadoresClasificados.map(i => [i.clave, i]));

    for (const regla of reglasPropias) {
      if (regla.activo === false) continue;

      const cumple = RecommendationEngine._evalCondition(regla, indMap);
      if (!cumple) continue;

      const key = `regla:${regla.id || regla.accion}`;
      if (visto.has(key)) continue;
      visto.add(key);

      recomendaciones.push({
        prioridad:    RecommendationEngine._toPriority(regla.nivel_riesgo),
        nivel_riesgo: regla.nivel_riesgo || 'Medio',
        accion:       regla.accion || regla.recomendacion || 'Ver protocolo',
        plazo:        regla.plazo || null,
        fuente:       'regla',
        indicador:    regla.variable_clave || null,
      });
    }

    // ── FUENTE 3: Niveles de escala con descripción/recomendación ─────────
    // Solo para niveles Alto/Crítico con descripción explícita en la escala
    const indicadoresDef = protocolo?.indicadores || [];
    const defMap = new Map(indicadoresDef.map(i => [i.clave, i]));

    for (const ind of indicadoresClasificados) {
      if (!ind.clasificacion) continue;
      const def = defMap.get(ind.clave);
      if (!def?.escalas) continue;

      // Buscar la escala que coincidió
      const escalaMatch = def.escalas.find(e => e.nivel === ind.clasificacion.nivel);
      if (!escalaMatch?.recomendacion) continue;

      const key = `escala:${ind.clave}:${ind.clasificacion.nivel}`;
      if (visto.has(key)) continue;
      visto.add(key);

      const prioridad = RecommendationEngine._toPriority(ind.clasificacion.nivel);
      if (prioridad < 2) continue; // Solo recomendar desde nivel Medio

      recomendaciones.push({
        prioridad,
        nivel_riesgo: ind.clasificacion.nivel,
        accion:       escalaMatch.recomendacion,
        plazo:        escalaMatch.plazo || null,
        fuente:       'escala',
        indicador:    ind.clave,
      });
    }

    // Ordenar por prioridad descendente (más urgente primero)
    recomendaciones.sort((a, b) => b.prioridad - a.prioridad);

    return { recomendaciones };
  }

  // ─── UTILIDADES ───────────────────────────────────────────────────────────

  /**
   * Evalúa si la condición de una regla de recomendación se cumple.
   * @param {Object} regla
   * @param {Map} indMap
   * @returns {boolean}
   */
  static _evalCondition(regla, indMap) {
    if (!regla.variable_clave) return false;

    // Evaluación por nivel de escala
    if (regla.nivel_escala) {
      const ind = indMap.get(regla.variable_clave);
      return ind?.clasificacion?.nivel === regla.nivel_escala;
    }

    // Evaluación por valor numérico
    if (regla.operador && regla.valor !== undefined) {
      const ind = indMap.get(regla.variable_clave);
      if (!ind || ind.valor === null) return false;
      const threshold = parseFloat(regla.valor);
      switch (regla.operador) {
        case '>':  return ind.valor >  threshold;
        case '<':  return ind.valor <  threshold;
        case '>=': return ind.valor >= threshold;
        case '<=': return ind.valor <= threshold;
        case '==': return ind.valor === threshold;
        case '!=': return ind.valor !== threshold;
        default:   return false;
      }
    }

    return false;
  }

  /**
   * Convierte un nivel de riesgo a prioridad numérica.
   * @param {string} nivel
   * @returns {number}
   */
  static _toPriority(nivel) {
    const map = { 'Sin riesgo': 0, Bajo: 1, Medio: 2, Alto: 3, Crítico: 4, Critico: 4 };
    return map[nivel] ?? 1;
  }
}

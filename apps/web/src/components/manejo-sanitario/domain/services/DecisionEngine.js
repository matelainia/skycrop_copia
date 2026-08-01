/**
 * DecisionEngine
 * ==============
 * Stub preparado para integración futura con Inteligencia Artificial.
 *
 * ESTADO ACTUAL: Implementación determinista basada en reglas del protocolo.
 * FUTURO: Integración con modelo de lenguaje o clasificador ML externo.
 *
 * PROPÓSITO:
 *   Capa de abstracción que separa la lógica de decisión agronómica compleja
 *   del resto del pipeline. Cuando el equipo integre IA, solo se reemplaza
 *   esta clase sin modificar el EvaluationPipeline.
 *
 * CAPACIDADES ACTUALES (basadas en reglas del protocolo):
 *   - Sugerir nivel de intervención agronómica
 *   - Proponer frecuencia de próxima visita de monitoreo
 *   - Generar resumen ejecutivo del estado del cultivo
 *   - Identificar el indicador más crítico de la evaluación
 *
 * CAPACIDADES FUTURAS (IA):
 *   - Predicción de evolución de la plaga en 7 días
 *   - Recomendación de insumos específicos
 *   - Comparación con histórico del lote
 *   - Alertas tempranas predictivas
 */

export class DecisionEngine {

  /**
   * Genera un resumen ejecutivo y la decisión de intervención.
   *
   * @param {Object} evaluationResult  — Resultado completo del pipeline
   * @param {Object} protocolo         — Definición del protocolo
   * @param {Object} [contexto]        — Contexto del lote/cultivo
   * @returns {Decision}
   */
  static decide(evaluationResult, protocolo, contexto = {}) {
    const { indicadores = [], alertas = [], riesgoGlobal = {}, recomendaciones = [] } = evaluationResult;

    // ── NIVEL DE INTERVENCIÓN ───────────────────────────────────────────────
    const nivelIntervencion = DecisionEngine._calcularNivelIntervencion(riesgoGlobal, alertas);

    // ── PRÓXIMA VISITA ──────────────────────────────────────────────────────
    const proximaVisita = DecisionEngine._sugerirProximaVisita(nivelIntervencion, protocolo);

    // ── INDICADOR MÁS CRÍTICO ───────────────────────────────────────────────
    const indicadorCritico = DecisionEngine._identificarIndicadorCritico(indicadores);

    // ── RESUMEN EJECUTIVO ───────────────────────────────────────────────────
    const resumen = DecisionEngine._generarResumen({
      riesgoGlobal,
      indicadorCritico,
      numAlertas:       alertas.length,
      numRecomendaciones: recomendaciones.length,
      nivelIntervencion,
    });

    return {
      nivelIntervencion,
      proximaVisita,
      indicadorCritico,
      resumen,
      // Placeholder para IA futura
      ia: {
        disponible:  false,
        proveedor:   null,
        prediccion7d: null,
        confianza:   null,
      },
      generadoEn: new Date().toISOString(),
    };
  }

  // ─── MÉTODOS INTERNOS ───────────────────────────────────────────────────────

  /**
   * Determina el nivel de intervención requerido basado en el riesgo.
   * @param {Object} riesgoGlobal
   * @param {Array}  alertas
   * @returns {'ninguna'|'preventiva'|'inmediata'|'urgente'}
   */
  static _calcularNivelIntervencion(riesgoGlobal, alertas) {
    const prioridad = riesgoGlobal.prioridad ?? 0;

    if (prioridad >= 4) return 'urgente';
    if (prioridad >= 3) return 'inmediata';
    if (prioridad >= 2 || alertas.length > 0) return 'preventiva';
    return 'ninguna';
  }

  /**
   * Sugiere el tiempo hasta la próxima visita de monitoreo.
   * @param {string} nivelIntervencion
   * @param {Object} protocolo
   * @returns {{ dias: number, label: string }}
   */
  static _sugerirProximaVisita(nivelIntervencion, protocolo) {
    // Respetar frecuencia definida en el protocolo si existe
    const frecuenciaProtocolo = protocolo?.frecuencia_monitoreo_dias;

    const defaults = {
      urgente:    { dias: 1,  label: 'Mañana' },
      inmediata:  { dias: 3,  label: 'En 3 días' },
      preventiva: { dias: 7,  label: 'En 7 días' },
      ninguna:    { dias: 14, label: 'En 14 días' },
    };

    const sugerencia = defaults[nivelIntervencion] || defaults.ninguna;

    if (frecuenciaProtocolo && nivelIntervencion === 'ninguna') {
      return { dias: frecuenciaProtocolo, label: `En ${frecuenciaProtocolo} días (protocolo)` };
    }

    return sugerencia;
  }

  /**
   * Identifica el indicador más crítico de la evaluación.
   * @param {Array} indicadores
   * @returns {Object|null}
   */
  static _identificarIndicadorCritico(indicadores) {
    const PRIORITY = { 'Sin riesgo': 0, Bajo: 1, Medio: 2, Alto: 3, Crítico: 4, Critico: 4 };

    let masCritico = null;
    let maxPriority = -1;

    for (const ind of indicadores) {
      const prioridad = PRIORITY[ind.clasificacion?.nivel] ?? -1;
      if (prioridad > maxPriority) {
        maxPriority = prioridad;
        masCritico  = ind;
      }
    }

    return masCritico;
  }

  /**
   * Genera un resumen ejecutivo en texto para mostrar al evaluador.
   * @param {Object} params
   * @returns {string}
   */
  static _generarResumen({ riesgoGlobal, indicadorCritico, numAlertas, numRecomendaciones, nivelIntervencion }) {
    const nivel = riesgoGlobal.nivel || 'Sin datos';

    if (nivel === 'Sin datos' || nivel === 'Sin riesgo') {
      return 'El lote evaluado no presenta alertas. Los indicadores se encuentran dentro de los rangos normales del protocolo.';
    }

    const partes = [`Nivel de riesgo global: ${nivel}.`];

    if (indicadorCritico) {
      partes.push(`Indicador más crítico: ${indicadorCritico.nombre || indicadorCritico.clave} (${indicadorCritico.valor} ${indicadorCritico.unidad}).`);
    }

    if (numAlertas > 0) {
      partes.push(`Se generaron ${numAlertas} alerta${numAlertas > 1 ? 's' : ''}.`);
    }

    if (numRecomendaciones > 0) {
      partes.push(`Se emiten ${numRecomendaciones} recomendación${numRecomendaciones > 1 ? 'es' : ''} agronómica${numRecomendaciones > 1 ? 's' : ''}.`);
    }

    const intervencionLabel = {
      urgente:    'Se requiere intervención URGENTE.',
      inmediata:  'Se recomienda intervención inmediata.',
      preventiva: 'Se sugiere una acción preventiva.',
      ninguna:    'No se requiere intervención activa.',
    };

    partes.push(intervencionLabel[nivelIntervencion] || '');

    return partes.filter(Boolean).join(' ');
  }
}

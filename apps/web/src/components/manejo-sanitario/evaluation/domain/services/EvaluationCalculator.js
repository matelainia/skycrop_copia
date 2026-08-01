/**
 * EvaluationCalculator
 * ====================
 * VERSIÓN 2.0 — Adaptador sobre EvaluationPipeline.
 *
 * CAMBIO ARQUITECTÓNICO (v2.0):
 *   Los métodos de cálculo de incidencia, hallazgos y recomendaciones
 *   ya NO contienen lógica hardcodeada. Delegan al EvaluationPipeline,
 *   que a su vez usa la configuración del protocolo como fuente de verdad.
 *
 * MÉTODOS UTILITARIOS PRESERVADOS (sin cambios):
 *   - calculateAreaEvaluada()      — Cálculo geométrico puro
 *   - calculateCoberturaPct()      — Cálculo de cobertura
 *
 * MÉTODOS OBSOLETOS (marcados @deprecated):
 *   - calculateIncidencia()        — Usa EvaluationPipeline en su lugar
 *   - getSmartRecommendations()    — Las recomendaciones las genera RecommendationEngine
 *
 * COMPATIBILIDAD:
 *   Todos los métodos siguen disponibles para no romper código existente.
 *   Se recomienda migrar gradualmente a EvaluationPipeline.runLive().
 */

import { EvaluationPipeline } from '../../../../domain/services/EvaluationPipeline.js';

export class EvaluationCalculator {

  /**
   * Calcula el área evaluada en hectáreas.
   * @param {number} areaLote          — Área total del lote en ha
   * @param {number} puntosEvaluados   — Número de puntos/plantas evaluadas
   * @param {number} puntosPlanificados — Tamaño de muestra del protocolo
   * @returns {number}
   */
  static calculateAreaEvaluada(areaLote, puntosEvaluados, puntosPlanificados) {
    if (!areaLote || !puntosPlanificados) return 0;
    const evaluados    = Math.max(0, parseFloat(puntosEvaluados) || 0);
    const planificados = Math.max(1, parseFloat(puntosPlanificados) || 100);
    const calculado    = areaLote * (evaluados / planificados);
    return parseFloat(Math.min(areaLote, calculado).toFixed(2));
  }

  /**
   * Calcula el porcentaje de cobertura.
   * @param {number} puntosEvaluados
   * @param {number} puntosPlanificados
   * @returns {number} Cobertura en porcentaje (0-100)
   */
  static calculateCoberturaPct(puntosEvaluados, puntosPlanificados) {
    if (!puntosPlanificados) return 0;
    const evaluados    = Math.max(0, parseFloat(puntosEvaluados) || 0);
    const planificados = Math.max(1, parseFloat(puntosPlanificados) || 100);
    return parseFloat(Math.min(100, (evaluados / planificados) * 100).toFixed(1));
  }

  /**
   * Ejecuta el pipeline completo de evaluación en tiempo real.
   * Reemplaza a calculateIncidencia() y getSmartRecommendations() combinados.
   *
   * @param {Object} protocolo         — Definición del protocolo activo
   * @param {Object} valores           — Valores capturados en campo
   * @param {Object} [contexto]        — Contexto agronómico
   * @returns {EvaluationResult}       — Resultado completo del pipeline
   */
  static runPipeline(protocolo, valores, contexto = {}) {
    return EvaluationPipeline.runLive(protocolo, valores, contexto);
  }

  /**
   * @deprecated Usar EvaluationCalculator.runPipeline() o EvaluationPipeline.runLive().
   * Calcula la incidencia sin protocolo. Útil solo para casos legacy sin protocolo disponible.
   *
   * @param {Object} valores — Valores de las variables
   * @returns {number}
   */
  static calculateIncidencia(valores) {
    const evaluados = parseFloat(valores.frutos_evaluados ?? valores.hojas_evaluadas ?? valores.puntos_evaluados ?? 0);
    const enfermos  = parseFloat(valores.frutos_enfermos ?? valores.hojas_infectadas ?? valores.puntos_afectados ?? 0);
    if (evaluados > 0) return parseFloat(((enfermos / evaluados) * 100).toFixed(2));
    return 0;
  }

  /**
   * @deprecated Las recomendaciones las genera RecommendationEngine desde el protocolo.
   * Mantiene lógica de cobertura (no es hardcoded de dominio) y genera una
   * recomendación de hallazgos de último recurso para compatibilidad.
   *
   * @param {number} coberturaPct
   * @param {number} puntosEvaluados
   * @param {number} puntosPlanificados
   * @param {number} incidenciaPct
   * @param {string} objetoNombre
   * @returns {Object}
   */
  static getSmartRecommendations(coberturaPct, puntosEvaluados, puntosPlanificados, incidenciaPct, objetoNombre) {
    const recommendations = {
      cobertura: { status: 'success', msg: 'Cobertura óptima.' },
      hallazgos: { status: 'success', msg: 'Bajo nivel de hallazgos. Continuar con monitoreo preventivo.' }
    };

    // Cobertura (recomendación de proceso — no es lógica agronómica)
    if (coberturaPct < 80) {
      const faltantes = Math.max(1, puntosPlanificados - puntosEvaluados);
      recommendations.cobertura = {
        status: 'warning',
        msg: `⚠ Cobertura insuficiente (${coberturaPct}%). Se recomienda evaluar ${faltantes} puntos adicionales.`
      };
    }

    // Hallazgos — solo si no hay protocolo disponible (legado)
    if (incidenciaPct > 15) {
      recommendations.hallazgos = {
        status: 'danger',
        msg: `⚠️ Alta incidencia de ${objetoNombre} (${incidenciaPct}%). Consultar protocolo para umbrales específicos.`
      };
    } else if (incidenciaPct > 5) {
      recommendations.hallazgos = {
        status: 'warning',
        msg: `⚠ Incidencia moderada de ${objetoNombre} (${incidenciaPct}%).`
      };
    } else if (incidenciaPct > 0) {
      recommendations.hallazgos = {
        status: 'success',
        msg: `✓ Incidencia leve detectada (${incidenciaPct}%).`
      };
    }

    return recommendations;
  }
}

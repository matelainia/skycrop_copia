/**
 * Servicio de dominio encargado de realizar los cálculos matemáticos, estimación de cobertura
 * y generación de alertas y recomendaciones en tiempo real basadas en datos agronómicos.
 */
export class EvaluationCalculator {
  /**
   * Calcula el área evaluada en hectáreas.
   * @param {number} areaLote - Área total del lote en ha
   * @param {number} puntosEvaluados - Número de puntos/plantas evaluadas
   * @param {number} puntosPlanificados - Tamaño de muestra del protocolo
   * @returns {number} Área evaluada en hectáreas
   */
  static calculateAreaEvaluada(areaLote, puntosEvaluados, puntosPlanificados) {
    if (!areaLote || !puntosPlanificados) return 0;
    const evaluados = Math.max(0, parseFloat(puntosEvaluados) || 0);
    const planificados = Math.max(1, parseFloat(puntosPlanificados) || 100);
    
    // El área evaluada no puede exceder el área del lote
    const calculado = areaLote * (evaluados / planificados);
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
    const evaluados = Math.max(0, parseFloat(puntosEvaluados) || 0);
    const planificados = Math.max(1, parseFloat(puntosPlanificados) || 100);
    
    const pct = (evaluados / planificados) * 100;
    return parseFloat(Math.min(100, pct).toFixed(1));
  }

  /**
   * Calcula la incidencia porcentual en base a los frutos/hojas muestreados y afectados.
   * @param {Object} valores - Valores de las variables
   * @returns {number|null} Incidencia o null si no se puede calcular
   */
  static calculateIncidencia(valores) {
    const evaluados = parseFloat(valores.frutos_evaluados ?? valores.hojas_evaluadas ?? valores.frutos_muestreados ?? valores.puntos_evaluados ?? 0);
    const enfermos = parseFloat(valores.frutos_enfermos ?? valores.hojas_infectadas ?? valores.frutos_brocados ?? valores.puntos_afectados ?? 0);

    if (evaluados > 0) {
      return parseFloat(((enfermos / evaluados) * 100).toFixed(2));
    }
    return 0;
  }

  /**
   * Genera recomendaciones inteligentes para el panel lateral de la UI.
   * @param {number} coberturaPct - Cobertura en %
   * @param {number} puntosEvaluados
   * @param {number} puntosPlanificados
   * @param {number} incidenciaPct - Incidencia en %
   * @param {string} objetoNombre - Nombre de la plaga o enfermedad
   * @returns {{ cobertura: { status: 'success'|'warning', msg: string }, hallazgos: { status: 'success'|'warning'|'danger', msg: string } }}
   */
  static getSmartRecommendations(coberturaPct, puntosEvaluados, puntosPlanificados, incidenciaPct, objetoNombre) {
    const recommendations = {
      cobertura: { status: 'success', msg: 'Cobertura óptima.' },
      hallazgos: { status: 'success', msg: 'Bajo nivel de hallazgos. Continuar con monitoreo preventivo.' }
    };

    // Recomendación de Cobertura
    if (coberturaPct < 80) {
      const faltantes = Math.max(1, puntosPlanificados - puntosEvaluados);
      recommendations.cobertura = {
        status: 'warning',
        msg: `⚠ Cobertura insuficiente (${coberturaPct}%). Se recomienda evaluar ${faltantes} puntos adicionales para cumplir con el protocolo.`
      };
    } else {
      recommendations.cobertura = {
        status: 'success',
        msg: '✅ Cobertura óptima alcanzada para el tamaño de la muestra.'
      };
    }

    // Recomendación de Hallazgos / Incidencia
    if (incidenciaPct > 15) {
      recommendations.hallazgos = {
        status: 'danger',
        msg: `⚠️ Alta incidencia de ${objetoNombre} (${incidenciaPct}%). Se recomienda realizar seguimiento en 7 días y coordinar tratamiento inmediato.`
      };
    } else if (incidenciaPct > 5) {
      recommendations.hallazgos = {
        status: 'warning',
        msg: `⚠ Incidencia moderada de ${objetoNombre} (${incidenciaPct}%). Incrementar frecuencia de monitoreo y evaluar umbrales económicos.`
      };
    } else if (incidenciaPct > 0) {
      recommendations.hallazgos = {
        status: 'success',
        msg: `✓ Incidencia leve detectada (${incidenciaPct}%). Mantener observación rutinaria en los próximos ciclos.`
      };
    }

    return recommendations;
  }
}

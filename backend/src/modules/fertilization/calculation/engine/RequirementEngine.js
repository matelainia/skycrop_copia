/**
 * RequirementEngine.js
 * Determina la demanda nutricional inicial del cultivo.
 *
 * RESPONSABILIDAD:
 *   Dado un cultivo, etapa, rendimiento objetivo y metodología,
 *   calcula los requerimientos nutricionales base (antes de ajustes de suelo).
 *
 * NO selecciona fertilizantes.
 * NO ajusta por suelo.
 * NO aplica eficiencias.
 *
 * SALIDA:
 *   { N: kg/ha, P2O5: kg/ha, K2O: kg/ha, Ca: kg/ha, Mg: kg/ha, S: kg/ha, ... }
 */

import {
  calculateAllRequirements,
  applyCorrectionFactors
} from '../formulas/requirement.formulas.js';

export class RequirementEngine {
  /**
   * Calcula los requerimientos nutricionales base.
   *
   * @param {Object} params
   * @param {import('../domain/entities/CropRequirement.js').CropRequirement[]} params.requirements
   *   Requerimientos del cultivo/etapa desde el repositorio
   * @param {number} params.targetYieldTHa - Rendimiento objetivo en t/ha
   * @param {string} [params.methodology] - Filtra por metodología; null = usa todas
   * @param {Object.<string, number>} [params.correctionFactors] - Factores del RuleEngine
   * @param {Object.<string, number>} [params.additionalRequirements] - Adicionales del RuleEngine
   * @returns {{ requirements: Object.<string, number>, metadata: Object }}
   */
  calculate({
    requirements,
    targetYieldTHa,
    methodology = null,
    correctionFactors = {},
    additionalRequirements = {}
  }) {
    // 1. Calcular requerimientos base según metodología
    let baseRequirements = calculateAllRequirements(requirements, targetYieldTHa, methodology);

    // 2. Agregar requerimientos adicionales de reglas
    for (const [nutrient, additional] of Object.entries(additionalRequirements)) {
      baseRequirements[nutrient] = (baseRequirements[nutrient] ?? 0) + additional;
    }

    // 3. Aplicar factores de corrección del RuleEngine
    const corrected =
      Object.keys(correctionFactors).length > 0
        ? applyCorrectionFactors(baseRequirements, correctionFactors)
        : baseRequirements;

    // 4. Redondear a 4 decimales para evitar floating-point ruido
    const finalRequirements = {};
    for (const [nutrient, value] of Object.entries(corrected)) {
      finalRequirements[nutrient] = parseFloat(value.toFixed(4));
    }

    return {
      requirements: finalRequirements,
      metadata: {
        targetYieldTHa,
        methodology: methodology ?? 'any',
        totalNutrients: Object.keys(finalRequirements).length,
        hasCorrectionFactors: Object.keys(correctionFactors).length > 0
      }
    };
  }
}

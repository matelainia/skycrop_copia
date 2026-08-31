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
  /**
   * @param {Object} params
   * @param {import('../domain/entities/CropRequirement.js').CropRequirement[]} params.requirements
   * @param {number} params.targetYieldTHa
   * @param {string|null} [params.methodology]
   * @param {Object.<string, number>} [params.correctionFactors]
   * @param {Object.<string, number>} [params.additionalRequirements]
   * @param {Record<string, number>|null} [params.customRequirements] — cuando Paso2 envía requerimiento personalizado, bypass DB
   * @param {Record<string, number>|null} [params.requirementDistributions] — % a aplicar en esta etapa/aplicación
   */
  calculate({
    requirements,
    targetYieldTHa,
    methodology = null,
    correctionFactors = {},
    additionalRequirements = {},
    customRequirements = null,
    requirementDistributions = null
  }) {
    // 1. Si el Paso 2 envió requerimientos personalizados, usarlos directamente (fuente = custom)
    //    Esto implementa la separación agronómica: DEMANDA definida por el técnico, no derivada ciegamente de DB
    let baseRequirements;
    let source = 'db';
    if (
      customRequirements &&
      typeof customRequirements === 'object' &&
      Object.keys(customRequirements).length > 0
    ) {
      baseRequirements = {};
      for (const [nutrient, val] of Object.entries(customRequirements)) {
        const num = Number(val);
        if (Number.isFinite(num) && num >= 0 && num > 0.001) {
          baseRequirements[nutrient] = num;
        }
      }
      source = 'custom';
    } else {
      baseRequirements = calculateAllRequirements(requirements, targetYieldTHa, methodology);
      source = 'db';
    }

    // 2. Aplicar distribución por aplicación si existe (ej: 30% del requerimiento anual en esta aplicación)
    if (
      requirementDistributions &&
      typeof requirementDistributions === 'object' &&
      Object.keys(requirementDistributions).length > 0
    ) {
      for (const [nutrient, pct] of Object.entries(requirementDistributions)) {
        if (
          baseRequirements[nutrient] !== undefined &&
          typeof pct === 'number' &&
          pct >= 0 &&
          pct <= 100
        ) {
          baseRequirements[nutrient] = parseFloat(
            (baseRequirements[nutrient] * (pct / 100)).toFixed(4)
          );
        }
      }
    }

    // 3. Agregar requerimientos adicionales de reglas
    for (const [nutrient, additional] of Object.entries(additionalRequirements)) {
      baseRequirements[nutrient] = (baseRequirements[nutrient] ?? 0) + additional;
    }

    // 4. Aplicar factores de corrección del RuleEngine
    const corrected =
      Object.keys(correctionFactors).length > 0
        ? applyCorrectionFactors(baseRequirements, correctionFactors)
        : baseRequirements;

    // 5. Redondear a 4 decimales para evitar floating-point ruido
    const finalRequirements = {};
    for (const [nutrient, value] of Object.entries(corrected)) {
      finalRequirements[nutrient] = parseFloat(value.toFixed(4));
    }

    return {
      requirements: finalRequirements,
      metadata: {
        targetYieldTHa,
        methodology: methodology ?? 'any',
        source,
        hasCustomRequirements: source === 'custom',
        hasDistribution: !!(
          requirementDistributions && Object.keys(requirementDistributions).length
        ),
        totalNutrients: Object.keys(finalRequirements).length,
        hasCorrectionFactors: Object.keys(correctionFactors).length > 0
      }
    };
  }
}

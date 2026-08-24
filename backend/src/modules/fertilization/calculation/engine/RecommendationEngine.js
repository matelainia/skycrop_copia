/**
 * RecommendationEngine.js
 * Genera el objeto de recomendación final a partir del resultado del cálculo.
 * Incluye datos para explicabilidad agronómica.
 */

import { buildFullBalance } from '../formulas/balance.formulas.js';

export class RecommendationEngine {
  /**
   * Genera la recomendación final estructurada.
   *
   * @param {Object} params
   * @param {Object} params.crop
   * @param {Object} params.stage
   * @param {Object} params.targetYield
   * @param {string} params.methodology
   * @param {Object} params.soilAnalysis
   * @param {Object.<string, number>} params.requirements
   * @param {Object} params.balanceDetail
   * @param {Object.<string, number>} params.efficiencies
   * @param {import('../domain/value-objects/FertilizerDose.js').FertilizerDose[]} params.selectedDoses
   * @param {Object.<string, number>} params.totalApplied
   * @param {string[]} params.warnings
   * @param {Object[]} params.appliedRules
   * @param {string} params.calculationVersion
   * @returns {import('../domain/entities/FertilizationResult.js').FertilizationResultData}
   */
  generate({
    crop,
    stage,
    targetYield,
    methodology,
    soilAnalysis,
    requirements,
    balanceDetail,
    efficiencies,
    selectedDoses,
    totalApplied,
    warnings,
    appliedRules,
    calculationVersion
  }) {
    // Balance completo con fertilizantes aplicados
    const fullBalance = buildFullBalance(balanceDetail, efficiencies, totalApplied);

    // Determinar status general
    const hasDeficit = fullBalance.some((b) => b.status === 'deficit');
    const hasSurplus = fullBalance.some((b) => b.status === 'surplus');
    const status = hasDeficit ? 'partial' : 'success';

    // Si hay excesos significativos, agregar warnings
    if (hasSurplus) {
      const surplusNutrients = fullBalance
        .filter((b) => b.status === 'surplus')
        .map((b) => b.nutrientCode);
      warnings.push(`Excedentes en: ${surplusNutrients.join(', ')}`);
    }

    const timestamp = new Date().toISOString();

    // Construir snapshot para trazabilidad
    const snapshot = {
      inputCropId: crop.id,
      inputStageId: stage.id,
      inputTargetYieldTHa: targetYield.value,
      inputMethodology: methodology,
      inputSoilAnalysisId: soilAnalysis?.id ?? null,
      rawRequirements: { ...requirements },
      balanceDetail: JSON.parse(JSON.stringify(balanceDetail)),
      efficiencies: { ...efficiencies },
      selectedFertilizers: selectedDoses.map((d) => d.toJSON()),
      appliedRules: JSON.parse(JSON.stringify(appliedRules)),
      calculationVersion,
      engineVersion: '1.0.0',
      snapshotAt: timestamp
    };

    return {
      status,
      crop: crop.toJSON ? crop.toJSON() : crop,
      phenologicalStage: stage.toJSON ? stage.toJSON() : stage,
      targetYield,
      methodology,
      soilAnalysis: soilAnalysis?.toJSON ? soilAnalysis.toJSON() : (soilAnalysis ?? null),
      requirements,
      soilAdjustment: balanceDetail,
      balance: fullBalance,
      fertilizers: selectedDoses.map((d) => d.toJSON()),
      balance_totals: {
        totalApplied,
        deficits: fullBalance
          .filter((b) => b.status === 'deficit')
          .map((b) => ({
            nutrientCode: b.nutrientCode,
            deficit_kg_ha: Math.abs(b.surplus_kg_ha)
          })),
        surpluses: fullBalance
          .filter((b) => b.status === 'surplus')
          .map((b) => ({
            nutrientCode: b.nutrientCode,
            surplus_kg_ha: b.surplus_kg_ha
          }))
      },
      warnings: [...new Set(warnings)], // Deduplicar warnings
      rulesApplied: appliedRules,
      calculationVersion,
      engineVersion: '1.0.0',
      timestamp,
      snapshot
    };
  }
}

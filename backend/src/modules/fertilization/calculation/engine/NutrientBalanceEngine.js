/**
 * NutrientBalanceEngine.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOTOR DE BALANCE NUTRICIONAL
 *
 * Arquitectura propuesta (§12):
 *   Demanda (PASO 2 - Requerimientos)
 *        -
 *   Oferta estimada del suelo (SoilSupplyEngine)
 *        =
 *   Déficit nutricional (necesidad de fertilización)
 *
 * RESPONSABILIDAD:
 *   - Recibe dos objetos conceptuales independientes:
 *     A) Demanda  → proveniente del Paso 2 (requerimiento nutricional del cultivo)
 *        { N: 120, P2O5: 40, K2O: 180, Ca: 35, Mg: 20, S: 15 } kg/ha
 *     B) Oferta   → proveniente del SoilSupplyEngine (Paso 1)
 *        { N: 35, P2O5: 18, K2O: 75, Ca: 20, Mg: 12, S: 8 } kg/ha disponibles
 *   - Calcula el balance neto por nutriente sin mezclar unidades heterogéneas
 *     (la conversión ya ocurrió en SoilSupplyEngine).
 *   - Clasifica cada nutriente como deficit / covered / surplus con tolerancia.
 *   - Genera el balanceDetail trazable usado por AdjustmentEngine y
 *     FertilizerEngine aguas abajo.
 *
 * NO aplica eficiencia ni factores de corrección de suelo aquí;
 * eso corresponde a AdjustmentEngine (siguiente capa).
 *
 * Delegado en balance.formulas.js para matemática pura.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import { BalanceEngine as _BalanceEngine } from './BalanceEngine.js';
import { calculateNetDemand } from '../formulas/balance.formulas.js';

export class NutrientBalanceEngine extends _BalanceEngine {
  /**
   * Calcula el balance nutricional neto.
   * @param {Object} params
   * @param {Object.<string, number>} params.requirements - Demanda kg/ha post-Requerimiento
   * @param {Object.<string, number>} params.soilContributions - Oferta kg/ha efectiva
   * @returns {{ netDemands: Object.<string, number>, balanceDetail: Object, summary: Object }}
   */
  calculateBalance({ requirements, soilContributions }) {
    const base = super.calculate({ requirements, soilContributions });
    // Enriquecer con summary agregado
    const summary = this._summarize(base.balanceDetail);
    return { ...base, summary };
  }

  /**
   * Alias para compatibilidad: FertilizationEngine llama calculate()
   */
  calculate({ requirements, soilContributions }) {
    return this.calculateBalance({ requirements, soilContributions });
  }

  /**
   * Calcula déficit individual para trazabilidad en UI Paso 3.
   * @param {number} requirement
   * @param {number} soilContribution
   * @returns {number}
   */
  computeDeficit(requirement, soilContribution) {
    return calculateNetDemand(requirement, soilContribution);
  }

  _summarize(balanceDetail) {
    let totalDeficit = 0;
    let totalCovered = 0;
    const deficits = [];
    const covered = [];
    for (const [nutrient, detail] of Object.entries(balanceDetail ?? {})) {
      if (detail.status === 'deficit') {
        deficits.push(nutrient);
        totalDeficit += detail.netDemandKgHa;
      } else {
        covered.push(nutrient);
        totalCovered += detail.soilContribution;
      }
    }
    return {
      totalDeficitKgHa: parseFloat(totalDeficit.toFixed(4)),
      totalCoveredKgHa: parseFloat(totalCovered.toFixed(4)),
      deficits,
      covered,
      hasDeficit: deficits.length > 0
    };
  }
}

export const BalanceEngineAlias = NutrientBalanceEngine;

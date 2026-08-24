/**
 * FertilizerDoseEngine.js
 * Convierte requerimientos nutricionales a kg de producto.
 * Analiza el efecto simultáneo sobre múltiples nutrientes.
 */

import { nutrientToProduct, productNutrientYield } from '../formulas/fertilizer.formulas.js';

export class FertilizerDoseEngine {
  /**
   * Calcula la dosis de un producto específico para cubrir la demanda de un nutriente objetivo.
   * Retorna también cuánto aporta de los demás nutrientes (efecto simultáneo).
   *
   * @param {import('../domain/entities/Fertilizer.js').Fertilizer} fertilizer
   * @param {string} targetNutrient - Nutriente objetivo de la dosis
   * @param {number} targetKgHa - kg/ha requeridos del nutriente objetivo
   * @returns {{ doseKgHa: number, nutrientsApplied: Object.<string, number> }}
   */
  calculateDoseForNutrient(fertilizer, targetNutrient, targetKgHa) {
    const pct = fertilizer.getNutrientPercent(targetNutrient);
    if (pct <= 0) {
      throw new Error(`Fertilizante "${fertilizer.commercialName}" no contiene ${targetNutrient}`);
    }
    const doseKgHa = nutrientToProduct(targetKgHa, pct);
    const nutrientsApplied = productNutrientYield(doseKgHa, fertilizer.composition);
    return { doseKgHa: parseFloat(doseKgHa.toFixed(4)), nutrientsApplied };
  }

  /**
   * Calcula los nutrientes aportados por una dosis fija de producto.
   *
   * @param {import('../domain/entities/Fertilizer.js').Fertilizer} fertilizer
   * @param {number} doseKgHa
   * @returns {Object.<string, number>}
   */
  calculateNutrientYield(fertilizer, doseKgHa) {
    return productNutrientYield(doseKgHa, fertilizer.composition);
  }
}

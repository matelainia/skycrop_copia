/**
 * FertilizerSelectionEngine.js
 * Selecciona la combinación de fertilizantes que cubre los requerimientos nutricionales.
 *
 * ARQUITECTURA DE ESTRATEGIAS:
 *   El engine delega la selección a una Strategy intercambiable.
 *
 *   FertilizerSelectionEngine
 *     └── GreedyStrategy (implementada aquí — primera iteración)
 *
 *   En el futuro se puede agregar:
 *     └── OptimizationStrategy (programación lineal)
 *     └── UserPreferenceStrategy (basada en preferencias del usuario)
 *
 * ALGORITMO GREEDY (primera implementación):
 *   1. Calcular el nutriente con mayor déficit relativo (demanda_efectiva/requerimiento)
 *   2. Entre los fertilizantes disponibles, seleccionar el de mayor coverageScore
 *      para ese nutriente (el que cubre más nutrientes simultáneamente)
 *   3. Calcular la dosis mínima para cubrir el nutriente más limitante
 *   4. Registrar cuánto aporta de todos los demás nutrientes
 *   5. Recalcular demandas remanentes
 *   6. Repetir hasta cubrir todos los nutrientes o agotar los productos disponibles
 *
 * RESTRICCIONES:
 *   - maxProducts: número máximo de productos en la solución
 *   - doseMin/doseMax: por producto
 *   - requiredProducts: productos que DEBEN incluirse
 *   - excludedProducts: productos que NO pueden usarse
 *
 * TRANSPARENCIA:
 *   El motor NUNCA oculta excedentes ni déficits residuales.
 *   Si la combinación deja un déficit, se reporta.
 *   Si genera un exceso, se reporta.
 */

import {
  evaluateFertilizerCoverage,
  calculateRemainingAfterDose,
  sumNutrientContributions
} from '../formulas/fertilizer.formulas.js';
import { FertilizerDose } from '../domain/value-objects/FertilizerDose.js';
import { CALC_TOLERANCES, SELECTION_STRATEGY } from '../domain/types/fertilization-calc.types.js';

const DEFAULT_MAX_PRODUCTS = 4;

export class FertilizerSelectionEngine {
  /**
   * @param {Object} params
   * @param {import('../domain/entities/Fertilizer.js').Fertilizer[]} params.availableFertilizers
   * @param {Object.<string, number>} params.effectiveDemands - kg/ha por nutriente
   * @param {Object} [params.constraints]
   * @param {number} [params.constraints.maxProducts]
   * @param {string[]} [params.constraints.requiredProductIds]
   * @param {string[]} [params.constraints.excludedProductIds]
   * @param {Object.<string, { min?: number, max?: number }>} [params.constraints.doseLimits]
   * @param {string} [params.strategy]
   * @returns {{ doses: FertilizerDose[], totalApplied: Object.<string, number>, warnings: string[] }}
   */
  select({
    availableFertilizers,
    effectiveDemands,
    constraints = {},
    strategy = SELECTION_STRATEGY.GREEDY
  }) {
    // Filtrar fertilizantes excluidos
    const excluded = new Set(constraints.excludedProductIds ?? []);
    const candidates = availableFertilizers.filter((f) => f.isActive && !excluded.has(f.id));

    if (strategy === SELECTION_STRATEGY.GREEDY) {
      return this._greedySelection(candidates, effectiveDemands, constraints);
    }

    // Fallback al greedy si la estrategia no está implementada
    return this._greedySelection(candidates, effectiveDemands, constraints);
  }

  /**
   * @private
   * Algoritmo greedy de selección de fertilizantes.
   */
  _greedySelection(candidates, effectiveDemands, constraints) {
    const maxProducts = constraints.maxProducts ?? DEFAULT_MAX_PRODUCTS;
    const requiredIds = new Set(constraints.requiredProductIds ?? []);
    const doseLimits = constraints.doseLimits ?? {};
    const tolerance = CALC_TOLERANCES.NUTRIENT_BALANCE_TOLERANCE_KG_HA;

    const selectedDoses = [];
    let remainingDemands = { ...effectiveDemands };
    let alreadyApplied = {};
    const warnings = [];

    // 1. Primero aplicar los productos requeridos obligatoriamente
    for (const fert of candidates) {
      if (!requiredIds.has(fert.id)) continue;
      const result = this._addFertilizer(fert, remainingDemands, alreadyApplied, doseLimits);
      if (result) {
        selectedDoses.push(result.dose);
        remainingDemands = result.remainingDemands;
        alreadyApplied = this._mergeApplied(alreadyApplied, result.dose.nutrientsKgHa);
      }
    }

    // 2. Selección greedy para los demás nutrientes pendientes
    let iterations = 0;
    const maxIterations = maxProducts * 3;

    while (selectedDoses.length < maxProducts && iterations < maxIterations) {
      iterations++;

      // Verificar si ya todos los nutrientes están cubiertos
      const pendingNutrients = Object.entries(remainingDemands)
        .filter(([, demand]) => demand > tolerance)
        .map(([nutrient]) => nutrient);

      if (pendingNutrients.length === 0) break;

      // Encontrar nutriente más limitante (mayor demanda remanente)
      const limitingNutrient = pendingNutrients.reduce((a, b) =>
        (remainingDemands[a] ?? 0) > (remainingDemands[b] ?? 0) ? a : b
      );

      // Rankear candidatos por coverageScore para las demandas remanentes
      const ranked = candidates
        .filter((f) => !selectedDoses.find((d) => d.fertilizerId === f.id)) // no repetir
        .filter((f) => (f.composition[limitingNutrient] ?? 0) > 0) // debe tener el nutriente limitante
        .map((f) => ({
          fertilizer: f,
          ...evaluateFertilizerCoverage(f, remainingDemands)
        }))
        .sort((a, b) => b.coverageScore - a.coverageScore);

      if (ranked.length === 0) {
        warnings.push(
          `No hay fertilizante disponible que contenga ${limitingNutrient}. Déficit residual: ${remainingDemands[limitingNutrient]?.toFixed(2)} kg/ha`
        );
        // Saltar este nutriente para no bloquear indefinidamente
        delete remainingDemands[limitingNutrient];
        continue;
      }

      const best = ranked[0];
      const result = this._addFertilizer(
        best.fertilizer,
        remainingDemands,
        alreadyApplied,
        doseLimits,
        limitingNutrient
      );
      if (result) {
        selectedDoses.push(result.dose);
        remainingDemands = result.remainingDemands;
        alreadyApplied = this._mergeApplied(alreadyApplied, result.dose.nutrientsKgHa);
      } else {
        break;
      }
    }

    // Advertencias de déficits residuales
    for (const [nutrient, demand] of Object.entries(remainingDemands)) {
      if (demand > tolerance) {
        warnings.push(
          `Déficit residual ${nutrient}: ${demand.toFixed(2)} kg/ha (no cubierto con fertilizantes disponibles)`
        );
      }
    }

    const totalApplied = sumNutrientContributions(
      selectedDoses.map((d) => ({ doseKgHa: d.doseKgHa, composition: d.nutrientsKgHa }))
    );

    // Advertencias de excesos significativos
    for (const [nutrient, applied] of Object.entries(totalApplied)) {
      const demand = effectiveDemands[nutrient] ?? 0;
      if (demand > 0) {
        const surplusPct = ((applied - demand) / demand) * 100;
        if (surplusPct > CALC_TOLERANCES.MAX_SURPLUS_PERCENT) {
          warnings.push(
            `Excedente de ${nutrient}: ${(applied - demand).toFixed(2)} kg/ha (${surplusPct.toFixed(1)}% sobre la demanda)`
          );
        }
      }
    }

    return { doses: selectedDoses, totalApplied, warnings };
  }

  /**
   * @private
   * Agrega un fertilizante a la solución, calculando su dosis óptima.
   */
  _addFertilizer(fertilizer, remainingDemands, alreadyApplied, doseLimits, targetNutrient = null) {
    // Determinar nutriente objetivo si no se especificó
    const nutrient =
      targetNutrient ??
      Object.entries(remainingDemands)
        .filter(([n, d]) => d > 0 && (fertilizer.composition[n] ?? 0) > 0)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

    if (!nutrient) return null;

    const demand = remainingDemands[nutrient];
    if (!demand || demand <= 0) return null;

    const pct = fertilizer.composition[nutrient] ?? 0;
    if (pct <= 0) return null;

    let doseKgHa = (demand * 100) / pct;

    // Aplicar límites de dosis
    const limits = doseLimits[fertilizer.id] ?? {};
    if (limits.min && doseKgHa < limits.min) doseKgHa = limits.min;
    if (limits.max && doseKgHa > limits.max) doseKgHa = limits.max;

    doseKgHa = parseFloat(doseKgHa.toFixed(4));

    const nutrientsApplied = fertilizer.getAllNutrientContributions(doseKgHa);
    const { remainingDemand: newRemaining } = calculateRemainingAfterDose(
      remainingDemands,
      alreadyApplied,
      doseKgHa,
      fertilizer.composition
    );

    const dose = new FertilizerDose(
      fertilizer.id,
      fertilizer.commercialName,
      doseKgHa,
      nutrientsApplied,
      `Seleccionado por déficit de ${nutrient}`
    );

    return { dose, remainingDemands: newRemaining };
  }

  /** @private */
  _mergeApplied(existing, newApplied) {
    const merged = { ...existing };
    for (const [nutrient, amount] of Object.entries(newApplied)) {
      merged[nutrient] = (merged[nutrient] ?? 0) + amount;
    }
    return merged;
  }
}

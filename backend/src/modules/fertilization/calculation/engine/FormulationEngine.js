/**
 * FormulationEngine.js
 * Motor de formulación: determina la combinación y dosis de las fuentes
 * fertilizantes registradas por el usuario que mejor satisface el
 * requerimiento nutricional proveniente del diagnóstico.
 *
 * FLUJO (§24, pasos 7-16):
 *   1. Construir matriz de composición.
 *   2. Identificar nutrientes requeridos sin fuente disponible → NO SOLUTION.
 *   3. Construir restricciones mínimas/máximas (rangos de cobertura).
 *   4. Aplicar restricciones de dosis por producto y disponibilidad.
 *   5. Resolver formulación con función objetivo ponderada configurable.
 *   6. Verificar factibilidad y reportar déficit/exceso sin ocultar nada.
 *
 * SOLVER DETERMINISTA:
 *   - Fase 1 (greedy por nutriente): cubre cada nutriente pendiente con la
 *     fuente disponible de mejor puntaje (concentración + cobertura cruzada,
 *     desempate por menor costo unitario y luego por nombre).
 *   - Fase 2 (refinamiento por coordenadas): ajusta dosis con pasos relativos
 *     decrecientes aceptando solo movimientos que reducen J(x). Sin azar:
 *     mismo input → mismo output.
 *
 * El motor NUNCA inventa fuentes ni fuerza una solución (§27.5).
 */

import {
  buildNutrientMatrix,
  findUncoveredNutrients,
  evaluateObjective
} from '../formulas/formulation.formulas.js';
import { resolveFormulationConfig } from '../config/formulation.config.js';

export const FORMULATION_STATUS = Object.freeze({
  FEASIBLE: 'feasible',
  NO_SOLUTION: 'no_solution'
});

export class FormulationEngine {
  /**
   * @param {Object} params
   * @param {import('../domain/entities/FertilizerSource.js').FertilizerSource[]} params.sources
   * @param {Record<string, number>} params.demands - requerimiento neto kg/ha por nutriente
   * @param {Object} [params.config] - overrides de configuración del motor
   */
  solve({ sources, demands, config: configOverrides = {} }) {
    const config = resolveFormulationConfig(configOverrides);
    const epsilon = config.tolerances.DEMAND_EPSILON_KG_HA;

    // Normalizar demandas: descartar valores no numéricos o <= epsilon
    const requirements = {};
    for (const [nutrient, value] of Object.entries(demands ?? {})) {
      const num = Number(value);
      if (Number.isFinite(num) && num > epsilon) requirements[nutrient] = num;
    }

    if (Object.keys(requirements).length === 0) {
      return {
        status: FORMULATION_STATUS.FEASIBLE,
        doses: [],
        contributions: {},
        uncoveredNutrients: [],
        warnings: ['El diagnóstico no produjo requerimientos nutricionales netos que formular.'],
        config
      };
    }

    const availableSources = sources.filter((s) => s.available);
    const { matrix } = buildNutrientMatrix(sources);

    // ── Factibilidad: nutrientes sin ninguna fuente disponible ────────────
    const { uncovered } = findUncoveredNutrients(requirements, availableSources, epsilon);
    if (uncovered.length > 0) {
      return {
        status: FORMULATION_STATUS.NO_SOLUTION,
        doses: [],
        contributions: {},
        uncoveredNutrients: uncovered.sort(),
        matrix,
        warnings: [
          `No existe una combinación factible con los fertilizantes seleccionados para cubrir todos los requerimientos nutricionales. Sin fuente disponible para: ${uncovered.sort().join(', ')}.`
        ],
        config
      };
    }

    // ── Fase 1: solución inicial greedy ───────────────────────────────────
    let x = this._greedyInitialSolution(availableSources, requirements, config);

    // ── Fase 2: refinamiento determinista por coordenadas ────────────────
    x = this._refine(x, availableSources, requirements, config);

    // ── Resultado ─────────────────────────────────────────────────────────
    const applied = availableSources
      .map((source) => ({ source, doseKgHa: x[source.id] ?? 0 }))
      .filter((a) => a.doseKgHa > epsilon)
      .sort((a, b) => b.doseKgHa - a.doseKgHa); // orden estable por dosis

    const evaluation = evaluateObjective(applied, requirements, config);
    const warnings = [];

    // Déficits residuales (no se ocultan jamás)
    for (const [nutrient, required] of Object.entries(requirements)) {
      const supplied = evaluation.contributions[nutrient] ?? 0;
      const min = (required * config.coverageRanges.minPct) / 100;
      if (supplied < min - epsilon) {
        warnings.push(
          `Déficit de ${nutrient}: aporte ${(Math.round(supplied * 100) / 100).toFixed(2)} kg/ha frente al mínimo ${min.toFixed(2)} kg/ha (${required.toFixed(2)} requeridos).`
        );
      }
      const max = (required * config.coverageRanges.maxPct) / 100;
      if (supplied > max + epsilon) {
        warnings.push(
          `Exceso de ${nutrient}: aporte ${(Math.round(supplied * 100) / 100).toFixed(2)} kg/ha supera el máximo recomendado de ${max.toFixed(2)} kg/ha.`
        );
      }
    }

    return {
      status: FORMULATION_STATUS.FEASIBLE,
      doses: applied.map(({ source, doseKgHa }) => ({
        sourceId: source.id,
        name: source.name,
        calculatedDoseKgHa: parseFloat(doseKgHa.toFixed(4)),
        composition: { ...source.composition }
      })),
      contributions: evaluation.contributions,
      objectiveParts: evaluation.parts,
      uncoveredNutrients: [],
      matrix,
      warnings,
      config
    };
  }

  /**
   * @private
   * Solución inicial greedy: para cada nutriente (mayor demanda primero),
   * elige la mejor fuente y dosifica para cubrir su rango objetivo.
   */
  _greedyInitialSolution(availableSources, requirements, config) {
    const x = {};
    const remaining = { ...requirements };
    const pending = new Set(Object.keys(requirements));

    while (pending.size > 0) {
      // Nutriente más limitante = mayor demanda remanente relativa
      const nutrient = [...pending].sort((a, b) => (remaining[b] ?? 0) - (remaining[a] ?? 0))[0];
      const demand = remaining[nutrient] ?? 0;

      if (demand <= config.tolerances.DEMAND_EPSILON_KG_HA) {
        pending.delete(nutrient);
        continue;
      }

      const candidates = availableSources.filter((s) => s.contains(nutrient));
      if (candidates.length === 0) {
        pending.delete(nutrient);
        continue;
      }

      const best = this._pickBestSource(candidates, nutrient, remaining);
      const fraction = best.fractionOf(nutrient);

      // Dosis para alcanzar el objetivo del nutriente dentro del rango
      const doseForTarget =
        (remaining[nutrient] * (config.coverageRanges.targetPct / 100)) / fraction;

      let dose = doseForTarget;
      if (best.maxDoseKgHa !== null) dose = Math.min(dose, best.maxDoseKgHa);
      if (best.minDoseKgHa !== null && dose < best.minDoseKgHa && dose > 0) {
        dose = best.minDoseKgHa;
      }
      dose = parseFloat(dose.toFixed(4));

      x[best.id] = parseFloat(((x[best.id] ?? 0) + dose).toFixed(4));

      // Descontar aportes de TODOS los nutrientes de esta dosis
      for (const [code, contribution] of Object.entries(best.contributionsFor(dose))) {
        remaining[code] = Math.max(0, (remaining[code] ?? 0) - contribution);
      }
      pending.delete(nutrient);
    }

    return x;
  }

  /**
   * @private
   * Puntaje de candidato: cobertura ponderada de nutrientes pendientes +
   * concentración en el nutriente objetivo; desempate determinista.
   */
  _pickBestSource(candidates, targetNutrient, remaining) {
    const scored = candidates.map((s) => {
      let crossCoverage = 0;
      for (const [nutrient, demand] of Object.entries(remaining)) {
        if (demand > 0 && s.contains(nutrient)) {
          crossCoverage += s.fractionOf(nutrient) * demand;
        }
      }
      const concentration = s.fractionOf(targetNutrient);
      const score = concentration * 1000 + crossCoverage;
      const unitCost = s.hasPrice() ? s.pricePerUnit : Number.POSITIVE_INFINITY;
      return { source: s, score, unitCost };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.unitCost !== b.unitCost) return a.unitCost - b.unitCost;
      return a.source.name.localeCompare(b.source.name);
    });
    return scored[0].source;
  }

  /**
   * @private
   * Refinamiento por coordenadas: prueba ajustes relativos sobre cada dosis
   * y conserva solo movimientos que mejoran la solución.
   *
   * PRIORIDAD LEXICOGRÁFICA (§8): primero se reduce la violación de las
   * restricciones de rango (aporte ≥ mínimo, aporte ≤ máximo); a igualdad
   * de restricciones, se minimiza la función objetivo ponderada J(x).
   */
  _refine(x, sources, requirements, config) {
    const limits = config.limits;
    const epsilon = config.tolerances.OBJECTIVE_IMPROVEMENT_EPSILON;
    const maxProducts = Math.min(limits.MAX_PRODUCTS ?? 10, sources.length);

    const toApplied = (candidate) =>
      sources
        .map((source) => ({ source, doseKgHa: candidate[source.id] ?? 0 }))
        .filter((a) => a.doseKgHa > 0)
        .slice(0, maxProducts);

    let current = { ...x };
    let bestEval = evaluateObjective(toApplied(current), requirements, config);
    let bestViolation = this._rangeViolation(bestEval.contributions, requirements, config);

    for (let iteration = 0; iteration < (limits.MAX_REFINEMENT_ITERATIONS ?? 300); iteration++) {
      let improved = false;

      for (const source of sources) {
        const baseDose = current[source.id] ?? 0;
        for (const step of limits.ADJUSTMENT_STEPS ?? [0.1, 0.02]) {
          for (const direction of [1, -1]) {
            let nextDose = baseDose * (1 + direction * step);
            if (nextDose < 0) nextDose = 0;
            if (source.maxDoseKgHa !== null) nextDose = Math.min(nextDose, source.maxDoseKgHa);
            nextDose = parseFloat(nextDose.toFixed(4));
            if (nextDose === baseDose) continue;

            const candidate = { ...current, [source.id]: nextDose };
            const evalCandidate = evaluateObjective(toApplied(candidate), requirements, config);
            const violationCandidate = this._rangeViolation(
              evalCandidate.contributions,
              requirements,
              config
            );

            // Aceptación: reduce violación de rango o, sin cambio de violación,
            // reduce el objetivo.
            const better =
              violationCandidate < bestViolation - epsilon ||
              (Math.abs(violationCandidate - bestViolation) <= epsilon &&
                evalCandidate.objective < bestEval.objective - epsilon);

            if (better) {
              current = candidate;
              bestEval = evalCandidate;
              bestViolation = violationCandidate;
              improved = true;
              break; // reinicia pasos para esta fuente
            }
          }
          if (improved) break;
        }
      }

      if (!improved) break;
    }

    return current;
  }

  /**
   * @private
   * Violación total normalizada de las restricciones de rango (§8):
   * Σ max(0, mínimo−aporte)/requerido + Σ max(0, aporte−máximo)/requerido.
   */
  _rangeViolation(contributions, requirements, config) {
    const { minPct, maxPct } = config.coverageRanges;
    let violation = 0;
    for (const [nutrient, required] of Object.entries(requirements)) {
      if (!required || required <= 0) continue;
      const supplied = contributions[nutrient] ?? 0;
      const min = (required * minPct) / 100;
      const max = (required * maxPct) / 100;
      if (supplied < min) violation += (min - supplied) / required;
      else if (supplied > max) violation += (supplied - max) / required;
    }
    return parseFloat(violation.toFixed(8));
  }
}

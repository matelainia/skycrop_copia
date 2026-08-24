/**
 * formulation.formulas.js
 * Fórmulas puras del motor de formulación de fertilizantes.
 * Determinísticas, testeables y sin efectos secundarios.
 *
 * CONVENCIÓN DE UNIDADES:
 *   - Unidad interna canónica: kg/ha (§16).
 *   - La matriz trabaja en fracciones: kg de nutriente por kg de producto (§6).
 *   - P2O5 y K2O se tratan como unidades propias; NUNCA se asume
 *     P = P2O5 ni K = K2O dentro del motor.
 */

import { FertilizerSource } from '../domain/entities/FertilizerSource.js';
import {
  DEFAULT_FORMULATION_CONFIG,
  DEFAULT_COVERAGE_RANGES
} from '../config/formulation.config.js';

// ─── Normalización de fuentes ─────────────────────────────────────────────────

/**
 * Convierte las fuentes crudas recibidas del request en entidades validadas.
 * Lanza si alguna fuente es inválida (regla §27.2: no asumir composiciones).
 *
 * @param {Object[]} rawSources
 * @returns {FertilizerSource[]}
 */
export function normalizeFertilizerSources(rawSources) {
  if (!Array.isArray(rawSources)) {
    throw new Error('fertilizerSources debe ser un arreglo.');
  }
  return rawSources.map(
    (raw, index) =>
      new FertilizerSource({
        ...raw,
        id: raw?.id ?? `source_${index + 1}`
      })
  );
}

// ─── Matriz de nutrientes (§6) ────────────────────────────────────────────────

/**
 * Construye la matriz producto × nutriente.
 * matriz[fuente][nutriente] = fracción (kg nutriente / kg producto).
 *
 * @param {FertilizerSource[]} sources
 * @param {string[]} [nutrientCodes] - nutrientes a incluir; default = unión de los declarados
 * @returns {{ matrix: Record<string, Record<string, number>>, nutrients: string[] }}
 */
export function buildNutrientMatrix(sources, nutrientCodes = null) {
  const codes = new Set(nutrientCodes ?? []);
  if (!nutrientCodes) {
    for (const s of sources) {
      for (const code of Object.keys(s.composition)) codes.add(code);
    }
  }
  const matrix = {};
  for (const s of sources) {
    const row = {};
    for (const code of codes) row[code] = s.fractionOf(code);
    matrix[s.id] = row;
  }
  return { matrix, nutrients: [...codes] };
}

// ─── Factibilidad (§11) ───────────────────────────────────────────────────────

/**
 * Identifica nutrientes requeridos que ninguna fuente disponible puede aportar.
 *
 * @param {Record<string, number>} demands - kg/ha requeridos por nutriente
 * @param {FertilizerSource[]} sources - solo fuentes disponibles
 * @param {number} [epsilon]
 * @returns {{ uncovered: string[], covered: string[] }}
 */
export function findUncoveredNutrients(demands, sources, epsilon = 0.01) {
  const uncovered = [];
  const covered = [];
  for (const [nutrient, demand] of Object.entries(demands)) {
    if (!demand || demand <= epsilon) continue; // nada que cubrir
    const hasSource = sources.some((s) => s.available && s.contains(nutrient));
    if (hasSource) covered.push(nutrient);
    else uncovered.push(nutrient);
  }
  return { uncovered, covered };
}

// ─── Aportes y cobertura (§19-§21) ────────────────────────────────────────────

/**
 * Suma el aporte nutricional real de todas las dosis (kg/ha).
 *
 * @param {Array<{ source: FertilizerSource, doseKgHa: number }>} applied
 * @returns {Record<string, number>}
 */
export function sumContributions(applied) {
  const total = {};
  for (const { source, doseKgHa } of applied) {
    for (const [code, kgHa] of Object.entries(source.contributionsFor(doseKgHa))) {
      total[code] = parseFloat(((total[code] ?? 0) + kgHa).toFixed(6));
    }
  }
  return total;
}

/**
 * Estado agronómico según rango de cobertura configurable (§5).
 * @param {number} supplied
 * @param {number} required
 * @param {{ minPct?: number, maxPct?: number }} [ranges]
 * @returns {{ coveragePct: number|null, status: 'adequate'|'deficit'|'excess'|'no_requirement' }}
 */
export function coverageStatus(supplied, required, ranges = DEFAULT_COVERAGE_RANGES) {
  if (!required || required <= 0) {
    return { coveragePct: null, status: 'no_requirement' };
  }
  const minPct = ranges.minPct ?? DEFAULT_COVERAGE_RANGES.minPct;
  const maxPct = ranges.maxPct ?? DEFAULT_COVERAGE_RANGES.maxPct;
  const coveragePct = parseFloat((((supplied ?? 0) / required) * 100).toFixed(2));
  let status = 'adequate';
  if (coveragePct < minPct) status = 'deficit';
  else if (coveragePct > maxPct) status = 'excess';
  return { coveragePct, status };
}

// ─── Función objetivo ponderada (§10) ─────────────────────────────────────────

/**
 * Desviación normalizada de un nutriente respecto al rango [min,max].
 * Dentro del rango penaliza levemente la distancia al objetivo;
 * fuera del rango la penalización es lineal sobre lo faltante/excedido.
 *
 * @param {number} supplied
 * @param {number} required
 * @param {{ minPct?: number, targetPct?: number, maxPct?: number }} [ranges]
 * @returns {{ deviation: number, excess: number }}
 */
export function nutrientDeviation(supplied, required, ranges = DEFAULT_COVERAGE_RANGES) {
  if (!required || required <= 0) return { deviation: 0, excess: 0 };
  const min = (required * (ranges.minPct ?? DEFAULT_COVERAGE_RANGES.minPct)) / 100;
  const target = (required * (ranges.targetPct ?? DEFAULT_COVERAGE_RANGES.targetPct)) / 100;
  const max = (required * (ranges.maxPct ?? DEFAULT_COVERAGE_RANGES.maxPct)) / 100;

  let deviation = 0;
  let excess = 0;
  if (supplied < min) {
    deviation += (min - supplied) / required; // faltante bajo el piso
  } else if (supplied > max) {
    excess += (supplied - max) / required; // exceso sobre el techo
  } else {
    // dentro del rango aceptable: atracción suave hacia el objetivo
    deviation += Math.abs(supplied - target) / required / 10;
  }
  return { deviation: parseFloat(deviation.toFixed(6)), excess: parseFloat(excess.toFixed(6)) };
}

/**
 * Evalúa J(x) para una solución candidata.
 * J = w_cost·costoNorm + w_dose·dosisNorm + w_dev·Σdesviación + w_exc·Σexceso
 *
 * @param {Array<{ source: FertilizerSource, doseKgHa: number }>} applied
 * @param {Record<string, number>} requirements - requerimiento neto por nutriente (kg/ha)
 * @param {Object} config - configuración resuelta del motor
 * @returns {{ objective: number, parts: Object, contributions: Record<string,number> }}
 */
export function evaluateObjective(applied, requirements, config) {
  const weights = config.objectiveWeights;
  const ranges = config.coverageRanges;

  const contributions = sumContributions(applied);
  let deviationSum = 0;
  let excessSum = 0;
  for (const [nutrient, required] of Object.entries(requirements)) {
    const { deviation, excess } = nutrientDeviation(contributions[nutrient] ?? 0, required, ranges);
    deviationSum += deviation;
    excessSum += excess;
  }

  const totalDose = applied.reduce((s, a) => s + a.doseKgHa, 0);
  const totalDemand = Object.values(requirements).reduce((s, v) => s + v, 0);
  const doseNorm = totalDemand > 0 ? totalDose / totalDemand : 0;

  // Costo: normalizado contra el costo de cubrir la demanda total con dosis puras.
  // Solo cuentan productos con precio declarado (regla §27.3: costo null si no hay precio).
  const pricedCost = applied.reduce(
    (s, a) => s + (a.source.hasPrice() ? a.doseKgHa * a.source.pricePerUnit : 0),
    0
  );
  const costRef = Math.max(totalDemand, 1);
  const costNorm = pricedCost > 0 ? pricedCost / costRef : 0;

  const objective =
    weights.cost * costNorm +
    weights.dose * doseNorm +
    weights.deviation * deviationSum +
    weights.excess * excessSum;

  return {
    objective: parseFloat(objective.toFixed(8)),
    parts: {
      costNorm: parseFloat(costNorm.toFixed(6)),
      doseNorm: parseFloat(doseNorm.toFixed(6)),
      deviationSum: parseFloat(deviationSum.toFixed(6)),
      excessSum: parseFloat(excessSum.toFixed(6))
    },
    contributions
  };
}

// ─── Conversión de unidades de salida (§13-§17) ──────────────────────────────

/**
 * Ajusta la dosis calculada a presentaciones comerciales y recalcula todo
 * a partir de los bultos redondeados (§14 — regla crítica).
 *
 * @param {number} calculatedDoseKgHa - dosis óptima del solver (kg/ha)
 * @param {number} areaHa - superficie del lote
 * @param {number|null} presentationKg - kg por bulto (null = sin presentación)
 * @returns {{
 *   calculatedDoseKgHa: number,
 *   totalKgExact: number,
 *   packages: number|null,
 *   packagesPerHa: number|null,
 *   totalPackagesKg: number|null,
 *   actualDoseKgHa: number
 * }}
 */
export function adjustToPackages(calculatedDoseKgHa, areaHa, presentationKg) {
  const totalKgExact = calculatedDoseKgHa * areaHa;

  if (!presentationKg || presentationKg <= 0 || !areaHa || areaHa <= 0) {
    return {
      calculatedDoseKgHa,
      totalKgExact: parseFloat(totalKgExact.toFixed(4)),
      packages: null,
      packagesPerHa: null,
      totalPackagesKg: null,
      actualDoseKgHa: parseFloat(calculatedDoseKgHa.toFixed(4))
    };
  }

  const packages = Math.ceil(totalKgExact / presentationKg);
  const totalPackagesKg = packages * presentationKg;
  const actualDoseKgHa = totalPackagesKg / areaHa;

  return {
    calculatedDoseKgHa: parseFloat(calculatedDoseKgHa.toFixed(4)),
    totalKgExact: parseFloat(totalKgExact.toFixed(4)),
    packages,
    packagesPerHa: parseFloat((packages / areaHa).toFixed(4)),
    totalPackagesKg,
    actualDoseKgHa: parseFloat(actualDoseKgHa.toFixed(4))
  };
}

/**
 * Dosis por planta a partir de la dosis real (§15).
 * @param {number} actualDoseKgHa
 * @param {number|null} plantsHa
 * @returns {{ kgPerPlant: number|null, gPerPlant: number|null }}
 */
export function dosePerPlant(actualDoseKgHa, plantsHa) {
  if (!plantsHa || plantsHa <= 0) return { kgPerPlant: null, gPerPlant: null };
  const kgPerPlant = actualDoseKgHa / plantsHa;
  return {
    kgPerPlant: parseFloat(kgPerPlant.toFixed(6)),
    gPerPlant: parseFloat((kgPerPlant * 1000).toFixed(2))
  };
}

/**
 * Conversión de presentación para mostrar (display-only).
 * El motor siempre trabaja en kg/ha canónico; esto solo transforma valores
 * ya calculados para el selector de unidades del frontend (§16-§18).
 *
 * @param {Object} product - producto del resultado (con actual_dose_kg_ha, total_packages…)
 * @param {'kg_ha'|'kg_planta'|'g_planta'|'bultos_ha'|'bultos_totales'|'kg_totales'} unit
 * @param {number|null} plantsHa
 * @returns {{ value: number|null, unitLabel: string }}
 */
export function displayDose(product, unit, plantsHa = null) {
  const plantBase = plantsHa ?? product.plants_ha;
  switch (unit) {
    case 'kg_planta':
      return {
        value: dosePerPlant(product.actual_dose_kg_ha, plantBase).kgPerPlant,
        unitLabel: 'kg/planta'
      };
    case 'g_planta':
      return {
        value: dosePerPlant(product.actual_dose_kg_ha, plantBase).gPerPlant,
        unitLabel: 'g/planta'
      };
    case 'bultos_ha':
      return { value: product.packages_per_ha, unitLabel: 'bultos/ha' };
    case 'bultos_totales':
      return { value: product.total_packages, unitLabel: 'bultos' };
    case 'kg_totales':
      return { value: product.total_kg, unitLabel: 'kg totales' };
    case 'kg_ha':
    default:
      return { value: product.actual_dose_kg_ha, unitLabel: 'kg/ha' };
  }
}

export { DEFAULT_FORMULATION_CONFIG };

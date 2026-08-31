/**
 * nutrientCalculations.js
 * Motor puro de aporte nutricional — funciones puras, sin React ni Supabase.
 *
 * Fórmula base (§11):
 *   aporte_nutriente_kg_ha = dosis_kg_ha × porcentaje / 100
 *   aporte_g_planta         = aporte_kg_ha / plantas_ha × 1000
 */

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─── 1. Aporte de un fertilizante ──────────────────────────────────────────

/**
 * @param {number} doseKgHa - kg de producto / ha
 * @param {Record<string,number|string>} composition - { N: 46, P2O5: 0, ... } en %
 * @returns {Record<string,number>} kg de nutriente / ha por nutriente
 */
export function calculateNutrientContribution(doseKgHa, composition) {
  const dose = safeNum(doseKgHa);
  if (dose === null || dose <= 0) return {};
  const out = {};
  for (const [nutrient, pctRaw] of Object.entries(composition || {})) {
    const pct = safeNum(pctRaw);
    if (pct === null || pct <= 0) continue;
    // clamp 0..100 — validación adicional en UI (§24)
    const clamped = Math.min(100, Math.max(0, pct));
    out[nutrient] = (dose * clamped) / 100;
  }
  return out;
}

/**
 * Aporte en g/planta a partir de kg/ha.
 * @param {Record<string,number>} contributionKgHa
 * @param {number} plantsPerHa
 * @returns {Record<string,number>}
 */
export function calculateNutrientPerPlant(contributionKgHa, plantsPerHa) {
  const p = safeNum(plantsPerHa);
  if (p === null || p <= 0) return {};
  const out = {};
  for (const [k, v] of Object.entries(contributionKgHa)) {
    const n = safeNum(v);
    if (n === null) continue;
    out[k] = (n / p) * 1000; // g/planta
  }
  return out;
}

// ─── 2. Aporte total (suma de todos los fertilizantes) (§12) ──────────────

/**
 * @param {Array<{ doseKgHa:number, composition:Record<string,number> }>} fertilizers
 * @returns {Record<string,number>} total kg/ha por nutriente
 */
export function calculateTotalContribution(fertilizers) {
  const total = {};
  for (const f of fertilizers || []) {
    const contrib = calculateNutrientContribution(f.doseKgHa, f.composition);
    for (const [nut, kg] of Object.entries(contrib)) {
      total[nut] = (total[nut] || 0) + kg;
    }
  }
  return total;
}

// ─── 3. Balance vs requerimiento (§12) ────────────────────────────────────

/**
 * @param {Record<string,number>} totalContribution - kg/ha aportado
 * @param {Record<string,number>} requirements - kg/ha requerido (de análisis/referencia)
 * @returns {Record<string,{ supplied:number, required:number, coverage:number|null, deficit:number|null, excess:number|null, status:'optimo'|'adecuado'|'bajo'|'exceso'|'sin_dato' }>}
 */
export function calculateRequirementCoverage(totalContribution, requirements) {
  const allKeys = new Set([
    ...Object.keys(totalContribution || {}),
    ...Object.keys(requirements || {}),
  ]);
  const result = {};
  for (const key of allKeys) {
    const supplied = safeNum(totalContribution?.[key]) ?? 0;
    const required = safeNum(requirements?.[key]);
    if (required === null || required <= 0) {
      result[key] = {
        supplied,
        required: required ?? 0,
        coverage: null,
        deficit: null,
        excess: null,
        status: 'sin_dato',
      };
      continue;
    }
    const coverage = (supplied / required) * 100;
    const deficit = supplied < required ? required - supplied : 0;
    const excess = supplied > required ? supplied - required : 0;
    let status = 'adecuado';
    if (coverage >= 95 && coverage <= 105) status = 'optimo';
    else if (coverage < 70) status = 'bajo';
    else if (coverage > 110) status = 'exceso';
    result[key] = { supplied, required, coverage, deficit, excess, status };
  }
  return result;
}

// ─── 4. Contribución individual por fertilizante (para tabla/gráfico §13) ──

/**
 * @param {Array<{ id:string, name:string, doseKgHa:number, composition:Record<string,number> }>} fertilizers
 * @returns {Array<{ id:string, name:string, contributions:Record<string,number> }>}
 */
export function calculatePerFertilizerContributions(fertilizers) {
  return (fertilizers || []).map((f) => ({
    id: f.id,
    name: f.name,
    doseKgHa: safeNum(f.doseKgHa) ?? 0,
    contributions: calculateNutrientContribution(f.doseKgHa, f.composition),
  }));
}

// ─── 5. Validaciones (§24) ─────────────────────────────────────────────────

export function validateComposition(composition) {
  const vals = Object.values(composition || {})
    .map(safeNum)
    .filter((v) => v !== null);
  for (const v of vals) {
    if (v < 0) return 'Los porcentajes no pueden ser negativos';
    if (v > 100) return 'Ningún nutriente puede superar 100%';
  }
  const sum = vals.filter((v) => v > 0).reduce((s, v) => s + v, 0);
  if (sum > 100) return `La suma de nutrientes (${sum.toFixed(1)}%) supera 100%`;
  return null;
}

/**
 * efficiency.formulas.js
 * Fórmulas para calcular y aplicar factores de eficiencia nutricional.
 * La eficiencia representa qué fracción del nutriente aplicado aprovecha el cultivo.
 * Funciones puras sin efectos secundarios.
 */

import { DEFAULT_EFFICIENCIES as EFFICIENCIES_BY_METHOD } from '../domain/types/fertilization-calc.types.js';

// ─── Eficiencias base para uso en fórmulas propias ────────────────────────────
// (Versión simplificada para conversiones directas, sin método de aplicación)
export const DEFAULT_EFFICIENCIES = {
  N: 0.65,
  P2O5: 0.25,
  P: 0.25,
  K2O: 0.7,
  K: 0.7,
  Ca: 0.55,
  Mg: 0.5,
  S: 0.6,
  Fe: 0.3,
  Mn: 0.35,
  Zn: 0.3,
  Cu: 0.35,
  B: 0.5,
  Mo: 0.4,
  Cl: 0.75
};

// ─── Ajustes por textura ──────────────────────────────────────────────────────
const TEXTURE_ADJUSTMENTS = {
  sandy: { N: 0.85, P2O5: 1.1, P: 1.1, K2O: 0.9, K: 0.9 },
  clay: { N: 1.1, P2O5: 0.8, P: 0.8, K2O: 0.85, K: 0.85 },
  loamy: {}
};

// ─── Ajustes por pH ───────────────────────────────────────────────────────────
const PH_ADJUSTMENTS = [
  { maxPh: 5.0, adj: { N: 0.9, P2O5: 0.6, P: 0.6, Ca: 0.85, Mg: 0.8 } },
  { maxPh: 6.0, adj: { N: 0.95, P2O5: 0.8, P: 0.8, Ca: 0.9, Mg: 0.9 } },
  { maxPh: 7.5, adj: {} },
  { maxPh: 9.0, adj: { N: 0.95, P2O5: 0.75, P: 0.75, Fe: 0.6, Mn: 0.65, Zn: 0.65 } }
];

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Obtiene la eficiencia para un nutriente según método de aplicación.
 * Usa la tabla DEFAULT_EFFICIENCIES del types.
 *
 * @param {string} nutrientCode
 * @param {'granular'|'liquid'|'foliar'} [method]
 * @returns {number}
 */
export function getEfficiencyByMethod(nutrientCode, method = 'granular') {
  const entry = EFFICIENCIES_BY_METHOD[nutrientCode];
  if (!entry) return DEFAULT_EFFICIENCIES[nutrientCode] ?? 0.5;
  return entry[method] ?? entry.granular ?? 0.5;
}

/**
 * Obtiene el factor de eficiencia para un nutriente según contexto avanzado.
 * Aplica ajustes por textura de suelo y pH.
 *
 * @param {string} nutrientCode
 * @param {Object} [context]
 * @param {string} [context.soilTexture]
 * @param {number} [context.soilPh]
 * @param {number} [context.customEfficiency]
 * @returns {number}
 */
export function getEfficiency(nutrientCode, context = {}) {
  const { soilTexture, soilPh, customEfficiency } = context;

  if (customEfficiency !== undefined && customEfficiency !== null) {
    return Math.min(1, Math.max(0, customEfficiency));
  }

  let efficiency = DEFAULT_EFFICIENCIES[nutrientCode] ?? 0.5;

  if (soilTexture) {
    const textureAdj = TEXTURE_ADJUSTMENTS[soilTexture]?.[nutrientCode];
    if (textureAdj !== undefined) efficiency *= textureAdj;
  }

  if (soilPh !== undefined && soilPh !== null) {
    const phBracket = PH_ADJUSTMENTS.find((b) => soilPh <= b.maxPh);
    if (phBracket) {
      const phAdj = phBracket.adj[nutrientCode];
      if (phAdj !== undefined) efficiency *= phAdj;
    }
  }

  return Math.min(1, Math.max(0.05, efficiency));
}

/**
 * Aplica el factor de eficiencia a la demanda neta.
 * demanda_efectiva = demanda_neta / eficiencia
 *
 * @param {number} netDemandKgHa
 * @param {number} efficiency
 * @returns {number}
 */
export function applyEfficiency(netDemandKgHa, efficiency) {
  if (efficiency <= 0) return netDemandKgHa;
  return netDemandKgHa / efficiency;
}

/**
 * Calcula la eficiencia aparente de una aplicación pasada.
 *
 * @param {number} nutrientUptake
 * @param {number} appliedKgHa
 * @returns {number}
 */
export function calculateApparentEfficiency(nutrientUptake, appliedKgHa) {
  if (appliedKgHa <= 0) return 0;
  return Math.min(1, Math.max(0, nutrientUptake / appliedKgHa));
}

// ─── Funciones compatibles con EfficiencyEngine ───────────────────────────────

/**
 * Construye mapa de eficiencias para el EfficiencyEngine.
 * Firma: buildEfficiencyMap(nutrients, ruleEfficiencies, applicationMethod)
 *
 * @param {string[]} nutrientCodes
 * @param {Record<string, number>} [ruleEfficiencies]
 * @param {'granular'|'liquid'|'foliar'} [applicationMethod]
 * @returns {Record<string, number>}
 */
export function buildEfficiencyMap(
  nutrientCodes,
  ruleEfficiencies = {},
  applicationMethod = 'granular'
) {
  const efficiencies = {};
  for (const code of nutrientCodes) {
    if (ruleEfficiencies[code] !== undefined) {
      efficiencies[code] = ruleEfficiencies[code];
    } else {
      efficiencies[code] = getEfficiencyByMethod(code, applicationMethod);
    }
  }
  return efficiencies;
}

/**
 * Aplica eficiencias a las demandas netas.
 * effectiveDemand = netDemand / efficiency
 *
 * @param {Record<string, number>} netDemands
 * @param {Record<string, number>} efficiencies
 * @returns {Record<string, number>}
 */
export function applyEfficiencies(netDemands, efficiencies) {
  const effective = {};
  for (const [nutrient, demand] of Object.entries(netDemands)) {
    const eff = efficiencies[nutrient] ?? DEFAULT_EFFICIENCIES[nutrient] ?? 0.5;
    effective[nutrient] = demand / Math.max(eff, 0.01);
  }
  return effective;
}

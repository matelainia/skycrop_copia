/**
 * balance.formulas.js
 * Fórmulas para calcular el balance nutricional neto.
 * Demanda neta = Requerimiento - Aporte suelo + Correcciones.
 * Funciones puras sin efectos secundarios.
 */

/**
 * Calcula la demanda neta de un nutriente.
 * Fórmula: demanda_neta = requerimiento - aporte_suelo
 * Si demanda_neta < 0, el suelo aporta más de lo necesario → no se aplica.
 *
 * @param {number} requirementKgHa - Requerimiento del cultivo (kg/ha)
 * @param {number} soilContributionKgHa - Aporte disponible del suelo (kg/ha)
 * @returns {number} Demanda neta en kg/ha (mínimo 0)
 */
export function calculateNetDemand(requirementKgHa, soilContributionKgHa) {
  return Math.max(0, requirementKgHa - soilContributionKgHa);
}

/**
 * Aplica un factor de corrección de suelo a la demanda neta.
 * El factor de corrección ajusta la dosis según el nivel del nutriente en suelo.
 * Factor > 1: nivel bajo → aumentar dosis. Factor < 1: nivel alto → reducir.
 *
 * @param {number} netDemandKgHa - Demanda neta (kg/ha)
 * @param {number} correctionFactor - Factor de corrección de suelo (0-1.5)
 * @returns {number} Demanda corregida en kg/ha
 */
export function applySoilCorrectionFactor(netDemandKgHa, correctionFactor) {
  return Math.max(0, netDemandKgHa * correctionFactor);
}

/**
 * Calcula el balance final entre lo aplicado y lo demandado.
 * Balance positivo = exceso; negativo = déficit.
 *
 * @param {number} appliedKgHa - Nutriente aplicado con fertilizantes (kg/ha)
 * @param {number} effectiveDemandKgHa - Demanda efectiva (ajustada por eficiencia)
 * @returns {number} Balance en kg/ha (+ exceso, - déficit)
 */
export function calculateBalance(appliedKgHa, effectiveDemandKgHa) {
  return appliedKgHa - effectiveDemandKgHa;
}

/**
 * Calcula el balance completo para un nutriente, paso a paso.
 * Devuelve todos los valores intermedios para trazabilidad.
 *
 * @param {Object} params
 * @param {number} params.requirementKgHa
 * @param {number} params.soilContributionKgHa
 * @param {number} params.correctionFactor
 * @param {number} params.efficiency - Factor de eficiencia (0-1)
 * @param {number} params.appliedKgHa - Lo que se va a aplicar
 * @returns {{ netDemand: number, correctedDemand: number, effectiveDemand: number, balance: number, applied: number }}
 */
export function calculateFullBalance({
  requirementKgHa,
  soilContributionKgHa,
  correctionFactor = 1.0,
  efficiency = 1.0,
  appliedKgHa = 0
}) {
  const netDemand = calculateNetDemand(requirementKgHa, soilContributionKgHa);
  const correctedDemand = applySoilCorrectionFactor(netDemand, correctionFactor);
  const effectiveDemand = correctedDemand / Math.max(efficiency, 0.01);
  const balance = calculateBalance(appliedKgHa, effectiveDemand);

  return {
    netDemand,
    correctedDemand,
    effectiveDemand,
    balance,
    applied: appliedKgHa
  };
}

/**
 * Agrega los balances de múltiples nutrientes en un resumen.
 * @param {Array<{nutrientCode: string, balance: number, effectiveDemand: number}>} balances
 * @returns {{ totalDeficit: number, totalExcess: number, nutrientsWithDeficit: string[], nutrientsWithExcess: string[] }}
 */
export function summarizeBalances(balances) {
  const nutrientsWithDeficit = [];
  const nutrientsWithExcess = [];
  let totalDeficit = 0;
  let totalExcess = 0;

  for (const { nutrientCode, balance, effectiveDemand } of balances) {
    if (balance < -0.1) {
      nutrientsWithDeficit.push(nutrientCode);
      totalDeficit += Math.abs(balance);
    } else if (effectiveDemand > 0 && balance > effectiveDemand * 0.1) {
      // Exceso > 10% sobre el requerimiento efectivo
      nutrientsWithExcess.push(nutrientCode);
      totalExcess += balance;
    }
  }

  return { totalDeficit, totalExcess, nutrientsWithDeficit, nutrientsWithExcess };
}

/**
 * Determina si el exceso de un nutriente es significativo (> umbral).
 * @param {number} appliedKgHa
 * @param {number} effectiveDemandKgHa
 * @param {number} [thresholdPct=15] - Porcentaje de exceso considerado significativo
 * @returns {boolean}
 */
export function isSignificantExcess(appliedKgHa, effectiveDemandKgHa, thresholdPct = 15) {
  if (effectiveDemandKgHa <= 0) return appliedKgHa > 0;
  const excessPct = ((appliedKgHa - effectiveDemandKgHa) / effectiveDemandKgHa) * 100;
  return excessPct > thresholdPct;
}

// ─── Compatibilidad con RecommendationEngine ──────────────────────────────────

/**
 * Construye el balance completo incluyendo fertilizantes aplicados.
 * Usado por RecommendationEngine para generar el resultado final.
 *
 * @param {Object} balanceDetail - { nutrientCode: { requirement, soilContribution, netDemand } }
 * @param {Record<string, number>} efficiencies
 * @param {Record<string, number>} totalApplied - kg/ha aplicados por nutriente
 * @returns {Array<{ nutrientCode, requirement, soilContribution, netDemand, effectiveDemand, applied, surplus_kg_ha, status }>}
 */
export function buildFullBalance(balanceDetail, efficiencies, totalApplied = {}) {
  const SURPLUS_STATUS = 'surplus';
  const DEFICIT_STATUS = 'deficit';
  const COVERED_STATUS = 'covered';
  const TOLERANCE = 0.5; // kg/ha

  return Object.entries(balanceDetail).map(([nutrientCode, detail]) => {
    const eff = efficiencies[nutrientCode] ?? 0.5;
    const effectiveDemand = eff > 0 ? detail.netDemand / eff : detail.netDemand;
    const applied = totalApplied[nutrientCode] ?? 0;
    const surplus = applied - effectiveDemand;

    let status = COVERED_STATUS;
    if (surplus < -TOLERANCE) status = DEFICIT_STATUS;
    else if (surplus > TOLERANCE) status = SURPLUS_STATUS;

    return {
      nutrientCode,
      requirement: detail.requirement ?? 0,
      soilContribution: detail.soilContribution ?? 0,
      netDemand: detail.netDemand ?? 0,
      effectiveDemand,
      efficiency: eff,
      applied,
      surplus_kg_ha: surplus,
      status
    };
  });
}

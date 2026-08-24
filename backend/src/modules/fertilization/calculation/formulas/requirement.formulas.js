/**
 * requirement.formulas.js
 * Fórmulas para calcular requerimientos nutricionales base.
 * Funciones puras sin efectos secundarios — facilita tests y auditoría.
 */

/**
 * Escala un requerimiento nutricional al rendimiento objetivo.
 * Fórmula: req_ajustado = req_referencia * (rendimiento_objetivo / rendimiento_referencia)
 *
 * @param {number} baseRequirementKgHa - Requerimiento base en kg/ha
 * @param {number} targetYield - Rendimiento objetivo en t/ha
 * @param {number} referenceYield - Rendimiento de referencia de la tabla (t/ha)
 * @returns {number} Requerimiento ajustado en kg/ha
 */
export function scaleRequirementToYield(baseRequirementKgHa, targetYield, referenceYield) {
  if (referenceYield <= 0) return baseRequirementKgHa;
  return (baseRequirementKgHa / referenceYield) * targetYield;
}

/**
 * Calcula el requerimiento nutricional por extracción de cultivo.
 * Fórmula: Req = Coeficiente_extracción * Rendimiento_objetivo
 *
 * @param {number} extractionCoefficient - kg de nutriente por tonelada de producto (kg/t)
 * @param {number} targetYield - Rendimiento objetivo (t/ha)
 * @returns {number} Requerimiento en kg/ha
 */
export function calculateByExtraction(extractionCoefficient, targetYield) {
  if (targetYield <= 0) return 0;
  return extractionCoefficient * targetYield;
}

/**
 * Agrega los requerimientos de múltiples etapas para obtener el total del ciclo.
 * Suma simple de los valores por nutriente.
 *
 * @param {Map<string, number>[]} stageRequirements - Array de mapas { nutrientCode: kgHa } por etapa
 * @returns {Map<string, number>} Requerimiento total del ciclo
 */
export function aggregateStageRequirements(stageRequirements) {
  const total = new Map();
  for (const stageMap of stageRequirements) {
    for (const [nutrientCode, amount] of stageMap) {
      total.set(nutrientCode, (total.get(nutrientCode) ?? 0) + amount);
    }
  }
  return total;
}

/**
 * Aplica un porcentaje de etapa al requerimiento total del ciclo.
 * Útil cuando se tienen requerimientos totales y se desea distribuir por etapa.
 * Fórmula: req_etapa = req_total * (porcentaje_etapa / 100)
 *
 * @param {number} totalRequirement - Requerimiento total del ciclo (kg/ha)
 * @param {number} stagePercentage - Porcentaje asignado a la etapa (0-100)
 * @returns {number} Requerimiento de la etapa (kg/ha)
 */
export function applyStagePercentage(totalRequirement, stagePercentage) {
  if (stagePercentage < 0 || stagePercentage > 100) {
    throw new Error(`stagePercentage debe estar entre 0 y 100 (recibido: ${stagePercentage})`);
  }
  return totalRequirement * (stagePercentage / 100);
}

/**
 * Normaliza un mapa de requerimientos aplicando un factor global.
 * Útil para ajustes de metodología o factores de corrección globales.
 *
 * @param {Map<string, number>} requirements - Mapa { nutrientCode: kgHa }
 * @param {number} factor - Factor multiplicador (ej. 1.1 para +10%)
 * @returns {Map<string, number>} Nuevo mapa con valores ajustados
 */
export function applyGlobalFactor(requirements, factor) {
  const adjusted = new Map();
  for (const [code, amount] of requirements) {
    adjusted.set(code, Math.max(0, amount * factor));
  }
  return adjusted;
}

/**
 * Combina dos mapas de requerimientos con pesos relativos.
 * Útil para promediar metodologías (ej. 70% extracción + 30% DRIS).
 *
 * @param {Map<string, number>} req1
 * @param {Map<string, number>} req2
 * @param {number} weight1 - Peso de req1 (0-1)
 * @returns {Map<string, number>}
 */
export function blendRequirements(req1, req2, weight1 = 0.5) {
  const weight2 = 1 - weight1;
  const allCodes = new Set([...req1.keys(), ...req2.keys()]);
  const blended = new Map();
  for (const code of allCodes) {
    const v1 = (req1.get(code) ?? 0) * weight1;
    const v2 = (req2.get(code) ?? 0) * weight2;
    blended.set(code, v1 + v2);
  }
  return blended;
}

// ─── Funciones compatibles con RequirementEngine ───────────────────────────────

/**
 * Calcula requerimientos de un array de CropRequirement para un rendimiento objetivo.
 * Usado por RequirementEngine. Agrupa por nutrientCode y escala al rendimiento objetivo.
 *
 * @param {import('../domain/entities/CropRequirement.js').CropRequirement[]} requirements
 * @param {number} targetYieldTHa
 * @param {string|null} [methodology]
 * @returns {Record<string, number>} { nutrientCode: kgHa }
 */
export function calculateAllRequirements(requirements, targetYieldTHa, methodology = null) {
  const filtered = methodology
    ? requirements.filter((r) => r.methodology === methodology || !r.methodology)
    : requirements;

  const result = {};
  for (const req of filtered) {
    const amount =
      req.referenceYield && req.referenceYield > 0
        ? scaleRequirementToYield(req.amountKgHa, targetYieldTHa, req.referenceYield)
        : req.amountKgHa;

    if (result[req.nutrientCode] !== undefined) {
      result[req.nutrientCode] = Math.max(result[req.nutrientCode], amount);
    } else {
      result[req.nutrientCode] = amount;
    }
  }
  return result;
}

/**
 * Aplica factores de corrección del RuleEngine a un mapa de requerimientos.
 * Soporta factor '_all' (global) y factores por nutriente.
 *
 * @param {Record<string, number>} requirements
 * @param {Record<string, number>} correctionFactors
 * @returns {Record<string, number>}
 */
export function applyCorrectionFactors(requirements, correctionFactors) {
  const result = { ...requirements };
  const globalFactor = correctionFactors['_all'];

  for (const [nutrient, value] of Object.entries(result)) {
    if (correctionFactors[nutrient] !== undefined) {
      result[nutrient] = value * correctionFactors[nutrient];
    } else if (globalFactor !== undefined) {
      result[nutrient] = value * globalFactor;
    }
  }
  return result;
}

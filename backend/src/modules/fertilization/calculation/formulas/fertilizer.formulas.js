/**
 * fertilizer.formulas.js
 * Fórmulas para conversión entre nutrientes y productos fertilizantes.
 * Funciones puras sin efectos secundarios.
 */

/**
 * Convierte kg de un nutriente requerido a kg de producto fertilizante.
 * Fórmula: kg_producto = (kg_nutriente × 100) / composicion_pct
 *
 * @param {number} kgNutrient - Kilogramos del nutriente requerido por ha
 * @param {number} compositionPct - Porcentaje del nutriente en el fertilizante (0-100)
 * @returns {number} Kilogramos de producto por ha, o Infinity si el fertilizante no contiene el nutriente
 */
export function nutrientToProduct(kgNutrient, compositionPct) {
  if (compositionPct <= 0) return Infinity;
  return (kgNutrient * 100) / compositionPct;
}

/**
 * Convierte kg de producto a kg de nutriente aportado.
 * Fórmula: kg_nutriente = (kg_producto × composicion_pct) / 100
 *
 * @param {number} kgProduct - Kilogramos de producto por ha
 * @param {number} compositionPct - Porcentaje del nutriente en el fertilizante (0-100)
 * @returns {number} Kilogramos del nutriente aportados por ha
 */
export function productToNutrient(kgProduct, compositionPct) {
  return (kgProduct * compositionPct) / 100;
}

/**
 * Calcula todos los nutrientes aportados por una dosis de un producto.
 *
 * @param {number} doseKgHa - Dosis del producto en kg/ha
 * @param {Record<string, number>} composition - Composición del fertilizante { nutrientCode: pct }
 * @returns {Record<string, number>} Nutrientes aportados en kg/ha
 */
export function productNutrientYield(doseKgHa, composition) {
  const result = {};
  for (const [nutrientCode, pct] of Object.entries(composition)) {
    result[nutrientCode] = productToNutrient(doseKgHa, pct);
  }
  return result;
}

/**
 * Calcula la dosis de producto que se requiere para cubrir el requerimiento de un nutriente,
 * teniendo en cuenta que el producto también aporta otros nutrientes simultáneamente.
 * Devuelve la dosis necesaria para el nutriente objetivo (sin considerar los secundarios).
 *
 * @param {string} targetNutrientCode - Nutriente objetivo
 * @param {number} targetKgHa - Requerimiento del nutriente objetivo (kg/ha)
 * @param {Record<string, number>} composition - Composición del fertilizante
 * @returns {{ doseKgHa: number, byproducts: Record<string, number> }}
 *   doseKgHa: dosis del producto
 *   byproducts: otros nutrientes aportados con esa dosis
 */
export function calculateDoseForNutrient(targetNutrientCode, targetKgHa, composition) {
  const targetPct = composition[targetNutrientCode];
  if (!targetPct || targetPct <= 0) {
    return { doseKgHa: Infinity, byproducts: {} };
  }

  const doseKgHa = nutrientToProduct(targetKgHa, targetPct);
  const byproducts = {};

  for (const [code, pct] of Object.entries(composition)) {
    if (code !== targetNutrientCode && pct > 0) {
      byproducts[code] = productToNutrient(doseKgHa, pct);
    }
  }

  return { doseKgHa, byproducts };
}

/**
 * Calcula cuántos kg de producto son necesarios para un área total.
 * @param {number} doseKgHa - Dosis por hectárea
 * @param {number} areaHa - Área en hectáreas
 * @returns {number} kg de producto total
 */
export function calculateTotalProduct(doseKgHa, areaHa) {
  return doseKgHa * areaHa;
}

/**
 * Convierte una dosis en kg/ha a sacos (bolsas) de 50 kg.
 * @param {number} doseKgHa - Dosis por ha
 * @param {number} areaHa - Área total
 * @param {number} [sacoBagsKg=50] - Peso por saco
 * @returns {{ totalKg: number, sacos: number, sacosEnteros: number }}
 */
export function calculateSacos(doseKgHa, areaHa, sacoBagsKg = 50) {
  const totalKg = calculateTotalProduct(doseKgHa, areaHa);
  const sacos = totalKg / sacoBagsKg;
  return {
    totalKg,
    sacos,
    sacosEnteros: Math.ceil(sacos)
  };
}

/**
 * Evalúa si una dosis está dentro del rango permitido para un fertilizante.
 * @param {number} doseKgHa
 * @param {number|null} minDose
 * @param {number|null} maxDose
 * @returns {{ valid: boolean, capped: number, reason: string|null }}
 */
export function validateAndCapDose(doseKgHa, minDose, maxDose) {
  let capped = doseKgHa;
  let reason = null;

  if (maxDose !== null && doseKgHa > maxDose) {
    capped = maxDose;
    reason = `Dosis limitada al máximo: ${maxDose} kg/ha`;
  } else if (minDose !== null && doseKgHa < minDose && doseKgHa > 0) {
    capped = minDose;
    reason = `Dosis mínima aplicada: ${minDose} kg/ha`;
  }

  return { valid: reason === null, capped, reason };
}

/**
 * Calcula el costo estimado de un fertilizante dado el precio por kg.
 * @param {number} doseKgHa
 * @param {number} areaHa
 * @param {number} pricePerKg
 * @param {string} [currency='USD']
 * @returns {{ totalKg: number, totalCost: number, costPerHa: number, currency: string }}
 */
export function calculateFertilizerCost(doseKgHa, areaHa, pricePerKg, currency = 'USD') {
  const totalKg = calculateTotalProduct(doseKgHa, areaHa);
  const totalCost = totalKg * pricePerKg;
  return {
    totalKg,
    totalCost,
    costPerHa: doseKgHa * pricePerKg,
    currency
  };
}

// ─── Compatibilidad con FertilizerSelectionEngine ─────────────────────────────

/**
 * Evalúa qué tan bien un fertilizante cubre las demandas remanentes.
 * Devuelve un coverageScore (mayor = mejor elección).
 *
 * @param {import('../domain/entities/Fertilizer.js').Fertilizer} fertilizer
 * @param {Record<string, number>} remainingDemands
 * @returns {{ coverageScore: number, nutrientsCovered: string[] }}
 */
export function evaluateFertilizerCoverage(fertilizer, remainingDemands) {
  let coverageScore = 0;
  const nutrientsCovered = [];

  for (const [nutrientCode, demand] of Object.entries(remainingDemands)) {
    if (demand <= 0) continue;
    const pct = fertilizer.composition?.[nutrientCode] ?? 0;
    if (pct > 0) {
      // El score pondera por la demanda relativa del nutriente
      coverageScore += (pct / 100) * demand;
      nutrientsCovered.push(nutrientCode);
    }
  }

  return { coverageScore, nutrientsCovered };
}

/**
 * Recalcula las demandas remanentes después de agregar una dosis de fertilizante.
 *
 * @param {Record<string, number>} currentDemands
 * @param {Record<string, number>} alreadyApplied
 * @param {number} doseKgHa
 * @param {Record<string, number>} composition - composición del fertilizante { nutrientCode: pct }
 * @returns {{ remainingDemand: Record<string, number> }}
 */
export function calculateRemainingAfterDose(currentDemands, alreadyApplied, doseKgHa, composition) {
  const remaining = { ...currentDemands };

  for (const [nutrientCode, pct] of Object.entries(composition)) {
    if (pct <= 0) continue;
    const contribution = (doseKgHa * pct) / 100;
    remaining[nutrientCode] = Math.max(0, (remaining[nutrientCode] ?? 0) - contribution);
  }

  return { remainingDemand: remaining };
}

/**
 * Suma las contribuciones nutricionales de múltiples dosis.
 *
 * @param {Array<{ doseKgHa: number, composition: Record<string, number> }>} doses
 * @returns {Record<string, number>} Total aplicado por nutriente (kg/ha)
 */
export function sumNutrientContributions(doses) {
  const total = {};
  for (const { doseKgHa, composition } of doses) {
    for (const [nutrientCode, pct] of Object.entries(composition)) {
      if (typeof pct !== 'number') continue;
      total[nutrientCode] = (total[nutrientCode] ?? 0) + (doseKgHa * pct) / 100;
    }
  }
  return total;
}

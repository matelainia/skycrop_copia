/**
 * doseCalculations.js
 * Motor puro de dosis — sin dependencias de React ni Supabase.
 * Todas las funciones son puras y testeables independientemente.
 *
 * Principio (§10): el usuario introduce UNA magnitud primaria;
 * SkyCrop deriva las demás. Nunca coexisten valores independientes
 * inconsistentes.
 *
 * Unidades canónicas:
 *   - kg/ha  (interna del motor)
 *   - kg/planta, g/planta, bultos/ha, kg/lote, bultos/lote
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─── 1. Cálculo central — una fuente de verdad ─────────────────────────────

/**
 * Deriva todas las métricas de dosis a partir de la magnitud primaria.
 *
 * @param {object} params
 * @param {'kg_ha'|'kg_planta'|'g_planta'|'bultos_ha'|'bultos_lote'|'kg_lote'} params.mode
 * @param {number} params.value - valor primario
 * @param {number} params.presentationKg - kg por bulto
 * @param {number} params.plantsPerHa - plantas/ha (requerido para kg_planta/g_planta)
 * @param {number} params.areaHa - ha del lote (requerido para bultos_lote/kg_lote)
 * @returns {{ kgPerHa:number|null, kgPerPlant:number|null, gPerPlant:number|null, bagsPerHa:number|null, bagsPerLot:number|null, kgTotal:number|null, presentationKg:number|null }}
 */
export function deriveDoseMetrics({ mode, value, presentationKg, plantsPerHa, areaHa }) {
  const v = safeNum(value);
  const pres = safeNum(presentationKg);
  const pHa = safeNum(plantsPerHa);
  const aHa = safeNum(areaHa);

  if (v === null || v <= 0) return emptyMetrics(pres);

  // pres requerido para conversiones con bultos
  const presOk = pres !== null && pres > 0;
  const pHaOk = pHa !== null && pHa > 0;
  const aHaOk = aHa !== null && aHa > 0;

  let kgPerHa = null;

  switch (mode) {
    case 'kg_ha':
      kgPerHa = v;
      break;
    case 'kg_planta':
      if (!pHaOk) return emptyMetrics(pres);
      kgPerHa = v * pHa;
      break;
    case 'g_planta':
      if (!pHaOk) return emptyMetrics(pres);
      kgPerHa = (v / 1000) * pHa;
      break;
    case 'bultos_ha':
      if (!presOk) return emptyMetrics(pres);
      kgPerHa = v * pres;
      break;
    case 'bultos_lote':
      if (!presOk || !aHaOk) return emptyMetrics(pres);
      kgPerHa = (v * pres) / aHa;
      break;
    case 'kg_lote':
      if (!aHaOk) return emptyMetrics(pres);
      kgPerHa = v / aHa;
      break;
    default:
      kgPerHa = v;
  }

  if (kgPerHa === null || kgPerHa <= 0) return emptyMetrics(pres);

  const kgPerPlant = pHaOk ? kgPerHa / pHa : null;
  const gPerPlant = kgPerPlant !== null ? kgPerPlant * 1000 : null;
  const bagsPerHa = presOk ? kgPerHa / pres : null;
  const bagsPerLot = bagsPerHa !== null && aHaOk ? bagsPerHa * aHa : null;
  const kgTotal = aHaOk ? kgPerHa * aHa : null;

  return {
    kgPerHa,
    kgPerPlant,
    gPerPlant,
    bagsPerHa,
    bagsPerLot,
    kgTotal,
    presentationKg: pres,
  };
}

function emptyMetrics(pres) {
  return {
    kgPerHa: null,
    kgPerPlant: null,
    gPerPlant: null,
    bagsPerHa: null,
    bagsPerLot: null,
    kgTotal: null,
    presentationKg: safeNum(pres),
  };
}

// ─── 2. Helpers de conveniencia (§8-§9) ────────────────────────────────────

export function calculateKgPerHa({ mode, value, plantsPerHa, presentationKg, areaHa }) {
  return deriveDoseMetrics({ mode, value, presentationKg, plantsPerHa, areaHa }).kgPerHa;
}

export function calculateKgPerPlant(kgPerHa, plantsPerHa) {
  const k = safeNum(kgPerHa);
  const p = safeNum(plantsPerHa);
  if (k === null || p === null || p <= 0) return null;
  return k / p;
}

export function calculateBagsPerHa(kgPerHa, presentationKg) {
  const k = safeNum(kgPerHa);
  const p = safeNum(presentationKg);
  if (k === null || p === null || p <= 0) return null;
  return k / p;
}

export function calculateTotalKg(kgPerHa, areaHa) {
  const k = safeNum(kgPerHa);
  const a = safeNum(areaHa);
  if (k === null || a === null || a <= 0) return null;
  return k * a;
}

export function calculateGPerPlant(kgPerPlant) {
  const k = safeNum(kgPerPlant);
  if (k === null) return null;
  return k * 1000;
}

// ─── 3. Validaciones (§24) ─────────────────────────────────────────────────

export function validateDoseInput({ value, mode, presentationKg, plantsPerHa, areaHa }) {
  const v = safeNum(value);
  if (v === null) return 'Ingresa un valor numérico válido';
  if (v <= 0) return 'La dosis debe ser mayor a 0';
  if ((mode === 'bultos_ha' || mode === 'bultos_lote') && (safeNum(presentationKg) === null || safeNum(presentationKg) <= 0))
    return 'Define la presentación (kg/bulto) para calcular bultos';
  if ((mode === 'kg_planta' || mode === 'g_planta') && (safeNum(plantsPerHa) === null || safeNum(plantsPerHa) <= 0))
    return 'Define plantas/ha para calcular dosis por planta';
  if ((mode === 'bultos_lote' || mode === 'kg_lote') && (safeNum(areaHa) === null || safeNum(areaHa) <= 0))
    return 'Define el área del lote para cálculos por lote';
  return null;
}

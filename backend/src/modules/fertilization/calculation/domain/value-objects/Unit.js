/**
 * Unit.js
 * Sistema formal de unidades con conversiones para el motor de fertilización.
 * Las unidades son inmutables y se representan como strings normalizados.
 */
import { InvalidUnitError, IncompatibleUnitsError } from '../errors/FertilizationErrors.js';

// ─── Catálogo de unidades soportadas ─────────────────────────────────────────

/** @enum {string} Unidades soportadas por el motor */
export const UNIT = /** @type {const} */ ({
  // Masa por área (aplicación de fertilizantes)
  KG_HA: 'kg/ha',
  G_HA: 'g/ha',
  T_HA: 't/ha', // tonelada/ha
  LB_ACRE: 'lb/acre',
  // Concentración en suelo
  MG_KG: 'mg/kg', // ≡ ppm (partes por millón)
  PPM: 'ppm', // alias de mg/kg
  CMOL_KG: 'cmol/kg', // ≡ meq/100g (capacidad de intercambio)
  MEQ_100G: 'meq/100g', // alias de cmol/kg
  // Porcentaje
  PERCENT: '%',
  // Concentración en foliar/agua
  MG_L: 'mg/L',
  G_L: 'g/L',
  // Relaciones y proporciones
  RATIO: 'ratio',
  // Rendimiento
  T_HA_YIELD: 't/ha/año',
  KG_HA_YEAR: 'kg/ha/año'
});

// ─── Grupos de compatibilidad ─────────────────────────────────────────────────

/**
 * Grupos de unidades compatibles para conversión.
 * Las unidades dentro de un grupo pueden convertirse entre sí.
 * @type {Record<string, string[]>}
 */
const UNIT_GROUPS = {
  mass_area: [UNIT.KG_HA, UNIT.G_HA, UNIT.T_HA, UNIT.LB_ACRE],
  soil_concentration: [UNIT.MG_KG, UNIT.PPM],
  cation_exchange: [UNIT.CMOL_KG, UNIT.MEQ_100G],
  percentage: [UNIT.PERCENT],
  solution: [UNIT.MG_L, UNIT.G_L]
};

/**
 * Factores de conversión base (todo a la unidad canónica del grupo):
 * mass_area → kg/ha
 * soil_concentration → mg/kg
 * cation_exchange → cmol/kg
 * percentage → %
 * solution → mg/L
 * @type {Record<string, number>}
 */
const TO_CANONICAL = {
  [UNIT.KG_HA]: 1,
  [UNIT.G_HA]: 0.001, // g/ha → kg/ha
  [UNIT.T_HA]: 1000, // t/ha → kg/ha
  [UNIT.LB_ACRE]: 1.12085, // lb/acre → kg/ha
  [UNIT.MG_KG]: 1,
  [UNIT.PPM]: 1, // ppm ≡ mg/kg
  [UNIT.CMOL_KG]: 1,
  [UNIT.MEQ_100G]: 1, // meq/100g ≡ cmol/kg
  [UNIT.PERCENT]: 1,
  [UNIT.MG_L]: 1,
  [UNIT.G_L]: 1000 // g/L → mg/L
};

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Obtiene el grupo de compatibilidad de una unidad.
 * @param {string} unit
 * @returns {string|null} Nombre del grupo, o null si no está soportada
 */
function getGroup(unit) {
  for (const [group, units] of Object.entries(UNIT_GROUPS)) {
    if (units.includes(unit)) return group;
  }
  return null;
}

/**
 * Verifica si una unidad está en el catálogo soportado.
 * @param {string} unit
 * @returns {boolean}
 */
export function isValidUnit(unit) {
  return Object.values(UNIT).includes(unit);
}

/**
 * Verifica si dos unidades son compatibles para conversión.
 * @param {string} unit1
 * @param {string} unit2
 * @returns {boolean}
 */
export function isCompatible(unit1, unit2) {
  if (unit1 === unit2) return true;
  const group1 = getGroup(unit1);
  const group2 = getGroup(unit2);
  return group1 !== null && group1 === group2;
}

/**
 * Convierte un valor entre unidades compatibles.
 * @param {number} value - Valor a convertir
 * @param {string} fromUnit - Unidad origen
 * @param {string} toUnit - Unidad destino
 * @returns {number} Valor convertido
 * @throws {InvalidUnitError} Si alguna unidad es inválida
 * @throws {IncompatibleUnitsError} Si las unidades no son compatibles
 */
export function convert(value, fromUnit, toUnit) {
  if (!isValidUnit(fromUnit)) {
    throw new InvalidUnitError(fromUnit, 'conversión de unidades');
  }
  if (!isValidUnit(toUnit)) {
    throw new InvalidUnitError(toUnit, 'conversión de unidades');
  }
  if (fromUnit === toUnit) return value;
  if (!isCompatible(fromUnit, toUnit)) {
    throw new IncompatibleUnitsError(fromUnit, toUnit);
  }

  // Convertir a canónico y luego al destino
  const canonical = value * TO_CANONICAL[fromUnit];
  const targetFactor = TO_CANONICAL[toUnit];
  return canonical / targetFactor;
}

/**
 * Normaliza un valor a la unidad canónica de su grupo.
 * Útil para comparar valores con diferentes unidades.
 * @param {number} value
 * @param {string} unit
 * @returns {{ value: number, unit: string }} Valor en unidad canónica
 * @throws {InvalidUnitError}
 */
export function normalize(value, unit) {
  if (!isValidUnit(unit)) {
    throw new InvalidUnitError(unit, 'normalización');
  }
  const group = getGroup(unit);
  if (!group) throw new InvalidUnitError(unit, 'sin grupo de compatibilidad');

  // Encontrar la unidad canónica del grupo (primer elemento del grupo)
  const canonicalUnit = UNIT_GROUPS[group][0];
  return {
    value: value * TO_CANONICAL[unit],
    unit: canonicalUnit
  };
}

/**
 * Obtiene las unidades disponibles en un grupo de compatibilidad.
 * @param {string} unitOrGroup - Una unidad del grupo, o el nombre del grupo
 * @returns {string[]}
 */
export function getCompatibleUnits(unitOrGroup) {
  // Si es un grupo directo
  if (UNIT_GROUPS[unitOrGroup]) return [...UNIT_GROUPS[unitOrGroup]];
  // Si es una unidad
  const group = getGroup(unitOrGroup);
  if (!group) return [unitOrGroup];
  return [...UNIT_GROUPS[group]];
}

/** Objeto de utilidad para usar Unit como módulo cohesivo */
export const UnitConverter = {
  UNIT,
  isValidUnit,
  isCompatible,
  convert,
  normalize,
  getCompatibleUnits
};

export default UnitConverter;

/**
 * Fertilizer.js
 * Entidad: Fertilizante con composición garantizada por nutriente.
 */
import { FERTILIZER_TYPE } from '../types/fertilization-calc.types.js';
import { InvalidFertilizerError, InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} FertilizerData
 * @property {string} id - UUID del fertilizante
 * @property {string} commercialName - Nombre comercial
 * @property {string} [manufacturer] - Fabricante
 * @property {string} [type] - Tipo: simple|compound|complex|organic|foliar|fertigation
 * @property {Record<string, number>} composition - Composición por nutriente (código → %)
 *   Ej: { 'N': 46 } para Urea, { 'N': 15, 'P2O5': 15, 'K2O': 15 } para NPK 15-15-15
 * @property {number} [density] - Densidad g/cm³ (para productos líquidos)
 * @property {string} [commercialUnit] - Unidad comercial (kg, L, ton, saco-50kg)
 * @property {number} [minDoseKgHa] - Dosis mínima recomendada kg/ha
 * @property {number} [maxDoseKgHa] - Dosis máxima recomendada kg/ha
 * @property {string} [status] - active|inactive
 * @property {Record<string, unknown>} [metadata]
 */

export class Fertilizer {
  /** @param {FertilizerData} data */
  constructor({
    id,
    commercialName,
    manufacturer = null,
    type = FERTILIZER_TYPE.SIMPLE,
    composition = {},
    density = null,
    commercialUnit = 'kg',
    minDoseKgHa = null,
    maxDoseKgHa = null,
    status = 'active',
    metadata = {}
  }) {
    if (!id) throw new InvalidInputError('Fertilizer: id es requerido.');
    if (!commercialName) throw new InvalidInputError('Fertilizer: commercialName es requerido.');
    if (!composition || Object.keys(composition).length === 0) {
      throw new InvalidFertilizerError(
        `Fertilizer "${commercialName}": la composición no puede estar vacía.`
      );
    }

    // Validar que la suma de porcentajes no supere 100
    const total = Object.values(composition).reduce((sum, v) => sum + v, 0);
    if (total > 100.01) {
      throw new InvalidFertilizerError(
        `Fertilizer "${commercialName}": la suma de porcentajes de composición (${total.toFixed(2)}%) supera el 100%.`,
        { composition, total }
      );
    }

    this.id = id;
    this.commercialName = commercialName;
    this.manufacturer = manufacturer;
    this.type = type;
    this.composition = Object.freeze({ ...composition });
    this.density = density;
    this.commercialUnit = commercialUnit;
    this.minDoseKgHa = minDoseKgHa;
    this.maxDoseKgHa = maxDoseKgHa;
    this.status = status;
    this.metadata = metadata;
  }

  /** @returns {boolean} */
  get isActive() {
    return this.status === 'active';
  }

  /**
   * Alias para compatibilidad — algunos engines llaman isActive() como función.
   * @returns {boolean}
   */
  isActiveMethod() {
    return this.isActive;
  }

  /** @returns {string[]} Códigos de nutrientes presentes en este fertilizante */
  get nutrientCodes() {
    return Object.keys(this.composition);
  }

  /**
   * Calcula los kg de un nutriente aportados por una dosis de producto.
   * @param {string} nutrientCode - Código del nutriente
   * @param {number} doseKgHa - Dosis del producto en kg/ha
   * @returns {number} kg del nutriente por ha
   */
  getNutrientContribution(nutrientCode, doseKgHa) {
    const pct = this.composition[nutrientCode] ?? 0;
    return (pct / 100) * doseKgHa;
  }

  /**
   * Calcula todos los nutrientes aportados por una dosis del producto.
   * @param {number} doseKgHa - Dosis del producto en kg/ha
   * @returns {Record<string, number>} { nutrientCode: kgHa }
   */
  getAllNutrientContributions(doseKgHa) {
    const result = {};
    for (const [code, pct] of Object.entries(this.composition)) {
      result[code] = (pct / 100) * doseKgHa;
    }
    return result;
  }

  /**
   * Calcula la dosis de producto necesaria para aportar X kg/ha de un nutriente.
   * @param {string} nutrientCode
   * @param {number} kgNutrientHa - kg del nutriente requeridos por ha
   * @returns {number} kg de producto por ha, o Infinity si el fertilizante no contiene ese nutriente
   */
  getDoseForNutrient(nutrientCode, kgNutrientHa) {
    const pct = this.composition[nutrientCode];
    if (!pct || pct === 0) return Infinity;
    return (kgNutrientHa * 100) / pct;
  }

  /**
   * Verifica si este fertilizante contiene un nutriente específico.
   * @param {string} nutrientCode
   * @returns {boolean}
   */
  contains(nutrientCode) {
    return (this.composition[nutrientCode] ?? 0) > 0;
  }

  /**
   * Serializa a objeto plano.
   * @returns {FertilizerData}
   */
  toObject() {
    return {
      id: this.id,
      commercialName: this.commercialName,
      manufacturer: this.manufacturer,
      type: this.type,
      composition: { ...this.composition },
      density: this.density,
      commercialUnit: this.commercialUnit,
      minDoseKgHa: this.minDoseKgHa,
      maxDoseKgHa: this.maxDoseKgHa,
      status: this.status,
      metadata: this.metadata
    };
  }

  /** @returns {string} */
  toString() {
    const comp = Object.entries(this.composition)
      .map(([k, v]) => `${k}:${v}%`)
      .join(', ');
    return `Fertilizer(${this.commercialName} [${comp}])`;
  }

  /**
   * Factory desde fila de Supabase (con composition como objeto JSON).
   * @param {Object} row - Fila de fert_calc_fertilizers con composition embebido
   * @returns {Fertilizer}
   */
  static fromRow(row) {
    return new Fertilizer({
      id: row.id,
      commercialName: row.commercial_name,
      manufacturer: row.manufacturer ?? null,
      type: row.type ?? FERTILIZER_TYPE.SIMPLE,
      composition: row.composition ?? {},
      density: row.density ?? null,
      commercialUnit: row.commercial_unit ?? 'kg',
      minDoseKgHa: row.min_dose_kg_ha ?? null,
      maxDoseKgHa: row.max_dose_kg_ha ?? null,
      status: row.status ?? 'active',
      metadata: row.metadata ?? {}
    });
  }
}

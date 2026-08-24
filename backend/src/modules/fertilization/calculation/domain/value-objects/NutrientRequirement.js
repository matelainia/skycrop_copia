/**
 * NutrientRequirement.js
 * Value Object inmutable que representa el requerimiento de un nutriente.
 * Cantidad en unidades normalizadas (kg/ha).
 */
import { UNIT } from './Unit.js';
import { InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} NutrientRequirementData
 * @property {string} nutrientCode - Código del nutriente (ej. 'N', 'P2O5', 'K2O')
 * @property {number} amount - Cantidad requerida
 * @property {string} unit - Unidad de medida (default: kg/ha)
 * @property {string} [source] - Origen del requerimiento (tabla, metodología)
 * @property {number} [minAmount] - Mínimo recomendado
 * @property {number} [maxAmount] - Máximo recomendado
 */

export class NutrientRequirement {
  /**
   * @param {NutrientRequirementData} data
   */
  constructor({
    nutrientCode,
    amount,
    unit = UNIT.KG_HA,
    source = null,
    minAmount = null,
    maxAmount = null
  }) {
    if (!nutrientCode || typeof nutrientCode !== 'string') {
      throw new InvalidInputError(
        'NutrientRequirement: nutrientCode es requerido y debe ser string.'
      );
    }
    if (typeof amount !== 'number' || amount < 0) {
      throw new InvalidInputError(
        `NutrientRequirement: amount debe ser un número >= 0 (recibido: ${amount}).`,
        { nutrientCode, amount }
      );
    }

    // Inmutable: Object.freeze después de asignar
    this._nutrientCode = nutrientCode;
    this._amount = amount;
    this._unit = unit;
    this._source = source;
    this._minAmount = minAmount;
    this._maxAmount = maxAmount;

    Object.freeze(this);
  }

  /** @returns {string} */
  get nutrientCode() {
    return this._nutrientCode;
  }

  /** @returns {number} Cantidad requerida */
  get amount() {
    return this._amount;
  }

  /** @returns {string} Unidad */
  get unit() {
    return this._unit;
  }

  /** @returns {string|null} Fuente del requerimiento */
  get source() {
    return this._source;
  }

  /** @returns {number|null} */
  get minAmount() {
    return this._minAmount;
  }

  /** @returns {number|null} */
  get maxAmount() {
    return this._maxAmount;
  }

  /**
   * Crea un nuevo NutrientRequirement con el amount modificado.
   * Preserva la inmutabilidad creando una nueva instancia.
   * @param {number} newAmount
   * @returns {NutrientRequirement}
   */
  withAmount(newAmount) {
    return new NutrientRequirement({
      nutrientCode: this._nutrientCode,
      amount: newAmount,
      unit: this._unit,
      source: this._source,
      minAmount: this._minAmount,
      maxAmount: this._maxAmount
    });
  }

  /**
   * Serializa a objeto plano para JSON/persistencia.
   * @returns {NutrientRequirementData}
   */
  toObject() {
    return {
      nutrientCode: this._nutrientCode,
      amount: this._amount,
      unit: this._unit,
      source: this._source,
      minAmount: this._minAmount,
      maxAmount: this._maxAmount
    };
  }

  /** @returns {string} */
  toString() {
    return `NutrientRequirement(${this._nutrientCode}: ${this._amount} ${this._unit})`;
  }

  /**
   * Factory: crea desde un objeto plano.
   * @param {NutrientRequirementData} data
   * @returns {NutrientRequirement}
   */
  static from(data) {
    return new NutrientRequirement(data);
  }

  /**
   * Factory: crea un Map de NutrientRequirement desde un objeto clave → valor.
   * @param {Record<string, number>} amountsMap - { 'N': 120, 'P2O5': 60, ... }
   * @param {string} [unit]
   * @param {string} [source]
   * @returns {Map<string, NutrientRequirement>}
   */
  static fromMap(amountsMap, unit = UNIT.KG_HA, source = null) {
    const map = new Map();
    for (const [nutrientCode, amount] of Object.entries(amountsMap)) {
      map.set(nutrientCode, new NutrientRequirement({ nutrientCode, amount, unit, source }));
    }
    return map;
  }
}

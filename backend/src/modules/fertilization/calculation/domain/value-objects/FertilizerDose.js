/**
 * FertilizerDose.js
 * Value Object inmutable que representa la dosis de un fertilizante
 * y los nutrientes que aporta.
 */
import { UNIT } from './Unit.js';
import { InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} FertilizerDoseData
 * @property {string} fertilizerId - UUID del fertilizante
 * @property {string} fertilizerName - Nombre comercial del fertilizante
 * @property {number} doseKgHa - Dosis en kg de producto/ha
 * @property {Record<string, number>} nutrientsApplied - Nutrientes aportados en kg/ha { 'N': 46, ... }
 * @property {string} [unit] - Unidad de la dosis (default: kg/ha)
 * @property {boolean} [isOverride] - Indica si es una selección manual del usuario
 * @property {string} [notes] - Notas de la selección
 */

export class FertilizerDose {
  /**
   * @param {FertilizerDoseData} data
   */
  constructor({
    fertilizerId,
    fertilizerName,
    doseKgHa,
    nutrientsApplied = {},
    unit = UNIT.KG_HA,
    isOverride = false,
    notes = null
  }) {
    if (!fertilizerId) {
      throw new InvalidInputError('FertilizerDose: fertilizerId es requerido.');
    }
    if (!fertilizerName) {
      throw new InvalidInputError('FertilizerDose: fertilizerName es requerido.');
    }
    if (typeof doseKgHa !== 'number' || doseKgHa < 0) {
      throw new InvalidInputError(
        `FertilizerDose: doseKgHa debe ser un número >= 0 (recibido: ${doseKgHa}).`,
        { fertilizerId, doseKgHa }
      );
    }

    this._fertilizerId = fertilizerId;
    this._fertilizerName = fertilizerName;
    this._doseKgHa = doseKgHa;
    // Congelar la copia de nutrientsApplied
    this._nutrientsApplied = Object.freeze({ ...nutrientsApplied });
    this._unit = unit;
    this._isOverride = isOverride;
    this._notes = notes;

    Object.freeze(this);
  }

  /** @returns {string} */
  get fertilizerId() {
    return this._fertilizerId;
  }

  /** @returns {string} */
  get fertilizerName() {
    return this._fertilizerName;
  }

  /** @returns {number} Dosis en kg de producto/ha */
  get doseKgHa() {
    return this._doseKgHa;
  }

  /** @returns {Readonly<Record<string, number>>} Nutrientes aportados en kg/ha */
  get nutrientsApplied() {
    return this._nutrientsApplied;
  }

  /** @returns {string} */
  get unit() {
    return this._unit;
  }

  /** @returns {boolean} Si la dosis fue ingresada manualmente */
  get isOverride() {
    return this._isOverride;
  }

  /** @returns {string|null} */
  get notes() {
    return this._notes;
  }

  /**
   * Calcula la cantidad de un nutriente específico aportada por esta dosis.
   * @param {string} nutrientCode
   * @returns {number} kg/ha del nutriente, o 0 si no aplica
   */
  getNutrientContribution(nutrientCode) {
    return this._nutrientsApplied[nutrientCode] ?? 0;
  }

  /**
   * Crea una nueva FertilizerDose con dosis modificada.
   * Recalcula nutrientsApplied proporcionalmente.
   * @param {number} newDoseKgHa
   * @returns {FertilizerDose}
   */
  withDose(newDoseKgHa) {
    const factor = this._doseKgHa > 0 ? newDoseKgHa / this._doseKgHa : 0;
    const newNutrients = {};
    for (const [code, amount] of Object.entries(this._nutrientsApplied)) {
      newNutrients[code] = amount * factor;
    }
    return new FertilizerDose({
      fertilizerId: this._fertilizerId,
      fertilizerName: this._fertilizerName,
      doseKgHa: newDoseKgHa,
      nutrientsApplied: newNutrients,
      unit: this._unit,
      isOverride: this._isOverride,
      notes: this._notes
    });
  }

  /**
   * Serializa a objeto plano.
   * @returns {FertilizerDoseData}
   */
  toObject() {
    return {
      fertilizerId: this._fertilizerId,
      fertilizerName: this._fertilizerName,
      doseKgHa: this._doseKgHa,
      nutrientsApplied: { ...this._nutrientsApplied },
      unit: this._unit,
      isOverride: this._isOverride,
      notes: this._notes
    };
  }

  /** @returns {string} */
  toString() {
    return `FertilizerDose(${this._fertilizerName}: ${this._doseKgHa} ${this._unit})`;
  }

  /**
   * Factory: crea desde objeto plano.
   * @param {FertilizerDoseData} data
   * @returns {FertilizerDose}
   */
  static from(data) {
    return new FertilizerDose(data);
  }
}

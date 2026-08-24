/**
 * SoilNutrient.js
 * Value Object que representa un nutriente en el análisis de suelo,
 * con su valor, unidad, clasificación y factor de corrección.
 */
import { SOIL_NUTRIENT_LEVEL, SOIL_CORRECTION_FACTORS } from '../types/fertilization-calc.types.js';
import { InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} SoilNutrientData
 * @property {string} nutrientCode - Código del nutriente (ej. 'N', 'P', 'K')
 * @property {number} value - Valor del análisis
 * @property {string} unit - Unidad del análisis (ej. 'mg/kg', '%', 'cmol/kg')
 * @property {string} [classification] - Nivel: very_low|low|medium|high|very_high|excess
 * @property {number} [correctionFactor] - Factor de corrección calculado (0-1.5)
 * @property {number} [availableContribution] - Aporte disponible estimado en kg/ha
 */

export class SoilNutrient {
  /**
   * @param {SoilNutrientData} data
   */
  constructor({
    nutrientCode,
    value,
    unit,
    classification = null,
    correctionFactor = null,
    availableContribution = 0
  }) {
    if (!nutrientCode || typeof nutrientCode !== 'string') {
      throw new InvalidInputError('SoilNutrient: nutrientCode es requerido.');
    }
    if (typeof value !== 'number' || isNaN(value)) {
      throw new InvalidInputError(
        `SoilNutrient: value debe ser un número válido (recibido: ${value}).`,
        { nutrientCode, value }
      );
    }
    if (!unit) {
      throw new InvalidInputError('SoilNutrient: unit es requerida.');
    }

    this._nutrientCode = nutrientCode;
    this._value = value;
    this._unit = unit;
    this._classification = classification;
    // Si no se proporciona factor, lo derivamos de la clasificación
    this._correctionFactor =
      correctionFactor ?? (classification ? (SOIL_CORRECTION_FACTORS[classification] ?? 1.0) : 1.0);
    this._availableContribution = availableContribution;

    Object.freeze(this);
  }

  /** @returns {string} */
  get nutrientCode() {
    return this._nutrientCode;
  }

  /** @returns {number} Valor del análisis de suelo */
  get value() {
    return this._value;
  }

  /** @returns {string} Unidad del análisis */
  get unit() {
    return this._unit;
  }

  /** @returns {string|null} Clasificación nutricional */
  get classification() {
    return this._classification;
  }

  /** @returns {number} Factor de corrección (0 = no aplicar, >1 = aumentar dosis) */
  get correctionFactor() {
    return this._correctionFactor;
  }

  /** @returns {number} Aporte disponible del suelo en kg/ha */
  get availableContribution() {
    return this._availableContribution;
  }

  /** @returns {boolean} Si el nivel está bajo (requiere corrección) */
  get isDeficient() {
    return (
      this._classification === SOIL_NUTRIENT_LEVEL.VERY_LOW ||
      this._classification === SOIL_NUTRIENT_LEVEL.LOW
    );
  }

  /** @returns {boolean} Si el nivel está alto (reducir o no aplicar) */
  get isExcess() {
    return (
      this._classification === SOIL_NUTRIENT_LEVEL.VERY_HIGH ||
      this._classification === SOIL_NUTRIENT_LEVEL.EXCESS
    );
  }

  /**
   * Serializa a objeto plano.
   * @returns {SoilNutrientData}
   */
  toObject() {
    return {
      nutrientCode: this._nutrientCode,
      value: this._value,
      unit: this._unit,
      classification: this._classification,
      correctionFactor: this._correctionFactor,
      availableContribution: this._availableContribution
    };
  }

  /** @returns {string} */
  toString() {
    return `SoilNutrient(${this._nutrientCode}: ${this._value} ${this._unit} [${this._classification ?? 'sin clasificar'}])`;
  }

  /**
   * Factory: crea desde objeto plano.
   * @param {SoilNutrientData} data
   * @returns {SoilNutrient}
   */
  static from(data) {
    return new SoilNutrient(data);
  }

  /**
   * Crea una copia con clasificación actualizada (recalcula correctionFactor).
   * @param {string} classification
   * @param {number} [availableContribution]
   * @returns {SoilNutrient}
   */
  withClassification(classification, availableContribution = this._availableContribution) {
    return new SoilNutrient({
      nutrientCode: this._nutrientCode,
      value: this._value,
      unit: this._unit,
      classification,
      correctionFactor: SOIL_CORRECTION_FACTORS[classification] ?? 1.0,
      availableContribution
    });
  }
}

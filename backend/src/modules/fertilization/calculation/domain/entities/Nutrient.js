/**
 * Nutrient.js
 * Entidad: Catálogo normalizado de nutrientes.
 * Incluye constantes de conversión elemental ↔ óxido.
 */
import {
  NUTRIENT_CONVERSION_FACTORS,
  ALL_NUTRIENT_CODES
} from '../types/fertilization-calc.types.js';
import { UnknownNutrientError, InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} NutrientData
 * @property {string} id - UUID del nutriente
 * @property {string} code - Código químico (ej. 'N', 'P2O5', 'K2O')
 * @property {string} name - Nombre completo (ej. 'Nitrógeno', 'Fósforo (P₂O₅)')
 * @property {string} [formula] - Fórmula química
 * @property {string} category - 'primary_macro'|'secondary_macro'|'micro'
 * @property {string} [defaultUnit] - Unidad por defecto en reportes de suelo
 * @property {number} [molecularWeight] - Peso molecular
 * @property {Record<string, number>} [conversionFactors] - Factores de conversión a/desde otras formas
 */

export class Nutrient {
  /** @param {NutrientData} data */
  constructor({
    id,
    code,
    name,
    formula = null,
    category = 'primary_macro',
    defaultUnit = 'mg/kg',
    molecularWeight = null,
    conversionFactors = {}
  }) {
    if (!id) throw new InvalidInputError('Nutrient: id es requerido.');
    if (!code) throw new InvalidInputError('Nutrient: code es requerido.');
    if (!name) throw new InvalidInputError('Nutrient: name es requerido.');

    this.id = id;
    this.code = code;
    this.name = name;
    this.formula = formula;
    this.category = category;
    this.defaultUnit = defaultUnit;
    this.molecularWeight = molecularWeight;
    this.conversionFactors = conversionFactors;
  }

  /** @returns {boolean} */
  get isPrimaryMacro() {
    return this.category === 'primary_macro';
  }

  /** @returns {boolean} */
  get isSecondaryMacro() {
    return this.category === 'secondary_macro';
  }

  /** @returns {boolean} */
  get isMicro() {
    return this.category === 'micro';
  }

  /**
   * Convierte una cantidad de este nutriente a otra forma.
   * Ej: N elemental no tiene conversión, P elemental → P₂O₅
   * @param {number} amount - Cantidad a convertir
   * @param {string} toForm - Forma destino (ej. 'P2O5', 'K2O')
   * @returns {number}
   */
  convertTo(amount, toForm) {
    const factor = this.conversionFactors[toForm];
    if (factor === undefined) return amount; // Sin conversión disponible
    return amount * factor;
  }

  /**
   * Serializa a objeto plano.
   * @returns {NutrientData}
   */
  toObject() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      formula: this.formula,
      category: this.category,
      defaultUnit: this.defaultUnit,
      molecularWeight: this.molecularWeight,
      conversionFactors: this.conversionFactors
    };
  }

  /** @returns {string} */
  toString() {
    return `Nutrient(${this.code}: ${this.name})`;
  }

  /**
   * Factory desde fila de Supabase.
   * @param {Object} row
   * @returns {Nutrient}
   */
  static fromRow(row) {
    return new Nutrient({
      id: row.id,
      code: row.code,
      name: row.name,
      formula: row.formula ?? null,
      category: row.category ?? 'primary_macro',
      defaultUnit: row.default_unit ?? 'mg/kg',
      molecularWeight: row.molecular_weight ?? null,
      conversionFactors: row.conversion_factors ?? {}
    });
  }

  /**
   * Catálogo de nutrientes estáticos de referencia (para uso sin DB).
   * Útil en tests y en el motor cuando se necesita resolver un nutriente por código.
   * @returns {Map<string, Nutrient>}
   */
  static getDefaultCatalog() {
    const catalog = [
      new Nutrient({
        id: 'nutrient-N',
        code: 'N',
        name: 'Nitrógeno',
        formula: 'N',
        category: 'primary_macro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      }),
      new Nutrient({
        id: 'nutrient-P2O5',
        code: 'P2O5',
        name: 'Fósforo (P₂O₅)',
        formula: 'P₂O₅',
        category: 'primary_macro',
        defaultUnit: 'mg/kg',
        conversionFactors: { P: NUTRIENT_CONVERSION_FACTORS.P2O5_TO_P }
      }),
      new Nutrient({
        id: 'nutrient-P',
        code: 'P',
        name: 'Fósforo elemental',
        formula: 'P',
        category: 'primary_macro',
        defaultUnit: 'mg/kg',
        conversionFactors: { P2O5: NUTRIENT_CONVERSION_FACTORS.P_TO_P2O5 }
      }),
      new Nutrient({
        id: 'nutrient-K2O',
        code: 'K2O',
        name: 'Potasio (K₂O)',
        formula: 'K₂O',
        category: 'primary_macro',
        defaultUnit: 'mg/kg',
        conversionFactors: { K: NUTRIENT_CONVERSION_FACTORS.K2O_TO_K }
      }),
      new Nutrient({
        id: 'nutrient-K',
        code: 'K',
        name: 'Potasio elemental',
        formula: 'K',
        category: 'primary_macro',
        defaultUnit: 'mg/kg',
        conversionFactors: { K2O: NUTRIENT_CONVERSION_FACTORS.K_TO_K2O }
      }),
      new Nutrient({
        id: 'nutrient-Ca',
        code: 'Ca',
        name: 'Calcio',
        formula: 'Ca',
        category: 'secondary_macro',
        defaultUnit: 'cmol/kg',
        conversionFactors: { CaO: NUTRIENT_CONVERSION_FACTORS.Ca_TO_CaO }
      }),
      new Nutrient({
        id: 'nutrient-Mg',
        code: 'Mg',
        name: 'Magnesio',
        formula: 'Mg',
        category: 'secondary_macro',
        defaultUnit: 'cmol/kg',
        conversionFactors: { MgO: NUTRIENT_CONVERSION_FACTORS.Mg_TO_MgO }
      }),
      new Nutrient({
        id: 'nutrient-S',
        code: 'S',
        name: 'Azufre',
        formula: 'S',
        category: 'secondary_macro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      }),
      new Nutrient({
        id: 'nutrient-Fe',
        code: 'Fe',
        name: 'Hierro',
        formula: 'Fe',
        category: 'micro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      }),
      new Nutrient({
        id: 'nutrient-Mn',
        code: 'Mn',
        name: 'Manganeso',
        formula: 'Mn',
        category: 'micro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      }),
      new Nutrient({
        id: 'nutrient-Zn',
        code: 'Zn',
        name: 'Zinc',
        formula: 'Zn',
        category: 'micro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      }),
      new Nutrient({
        id: 'nutrient-Cu',
        code: 'Cu',
        name: 'Cobre',
        formula: 'Cu',
        category: 'micro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      }),
      new Nutrient({
        id: 'nutrient-B',
        code: 'B',
        name: 'Boro',
        formula: 'B',
        category: 'micro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      }),
      new Nutrient({
        id: 'nutrient-Mo',
        code: 'Mo',
        name: 'Molibdeno',
        formula: 'Mo',
        category: 'micro',
        defaultUnit: 'mg/kg',
        conversionFactors: {}
      })
    ];

    const map = new Map();
    for (const n of catalog) {
      map.set(n.code, n);
    }
    return map;
  }

  /**
   * Busca un nutriente por código en el catálogo por defecto.
   * @param {string} code
   * @returns {Nutrient}
   * @throws {UnknownNutrientError}
   */
  static findByCode(code) {
    const catalog = Nutrient.getDefaultCatalog();
    const nutrient = catalog.get(code);
    if (!nutrient) throw new UnknownNutrientError(code);
    return nutrient;
  }
}

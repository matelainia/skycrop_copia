/**
 * Crop.js
 * Entidad del dominio: Cultivo (catálogo de cultivos para el motor de cálculo).
 */
import { CROP_STATUS } from '../types/fertilization-calc.types.js';
import { InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} CropData
 * @property {string} id - UUID del cultivo
 * @property {string} name - Nombre común (ej. 'Cacao')
 * @property {string} [scientificName] - Nombre científico
 * @property {string} [family] - Familia botánica
 * @property {string} [status] - Estado: active|inactive|draft
 * @property {Record<string, unknown>} [metadata] - Datos adicionales
 */

export class Crop {
  /** @param {CropData} data */
  constructor({
    id,
    name,
    scientificName = null,
    family = null,
    status = CROP_STATUS.ACTIVE,
    metadata = {}
  }) {
    if (!id) throw new InvalidInputError('Crop: id es requerido.');
    if (!name || name.trim().length === 0) throw new InvalidInputError('Crop: name es requerido.');

    this.id = id;
    this.name = name.trim();
    this.scientificName = scientificName;
    this.family = family;
    this.status = status;
    this.metadata = metadata;
  }

  /** @returns {boolean} */
  get isActive() {
    return this.status === CROP_STATUS.ACTIVE;
  }

  /** @returns {string} */
  toString() {
    return `Crop(${this.id}: ${this.name})`;
  }

  /**
   * Serializa a objeto plano.
   * @returns {CropData}
   */
  toObject() {
    return {
      id: this.id,
      name: this.name,
      scientificName: this.scientificName,
      family: this.family,
      status: this.status,
      metadata: this.metadata
    };
  }

  /**
   * Factory desde objeto plano (ej. fila de Supabase).
   * @param {Object} row - Fila de la tabla fert_calc_crops
   * @returns {Crop}
   */
  static fromRow(row) {
    return new Crop({
      id: row.id,
      name: row.name,
      scientificName: row.scientific_name ?? null,
      family: row.family ?? null,
      status: row.status ?? CROP_STATUS.ACTIVE,
      metadata: row.metadata ?? {}
    });
  }
}

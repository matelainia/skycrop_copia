/**
 * PhenologicalStage.js
 * Entidad: Etapa fenológica de un cultivo.
 * Las etapas tienen un orden que define la secuencia del ciclo productivo.
 */
import { InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} PhenologicalStageData
 * @property {string} id - UUID de la etapa
 * @property {string} cropId - UUID del cultivo al que pertenece
 * @property {string} name - Nombre de la etapa (ej. 'Floración', 'Llenado de grano')
 * @property {number} order - Orden en el ciclo (1, 2, 3...)
 * @property {string} [description] - Descripción agronómica de la etapa
 * @property {number} [durationDays] - Duración típica en días
 * @property {string} [status] - active|inactive
 */

export class PhenologicalStage {
  /** @param {PhenologicalStageData} data */
  constructor({
    id,
    cropId,
    name,
    order,
    description = null,
    durationDays = null,
    status = 'active'
  }) {
    if (!id) throw new InvalidInputError('PhenologicalStage: id es requerido.');
    if (!cropId) throw new InvalidInputError('PhenologicalStage: cropId es requerido.');
    if (!name || name.trim().length === 0) {
      throw new InvalidInputError('PhenologicalStage: name es requerido.');
    }
    if (typeof order !== 'number' || order < 1) {
      throw new InvalidInputError(
        `PhenologicalStage: order debe ser un entero >= 1 (recibido: ${order}).`
      );
    }

    this.id = id;
    this.cropId = cropId;
    this.name = name.trim();
    this.order = order;
    this.description = description;
    this.durationDays = durationDays;
    this.status = status;
  }

  /** @returns {boolean} */
  get isActive() {
    return this.status === 'active';
  }

  /** @returns {string} */
  toString() {
    return `PhenologicalStage(${this.name} [orden: ${this.order}])`;
  }

  /**
   * Serializa a objeto plano.
   * @returns {PhenologicalStageData}
   */
  toObject() {
    return {
      id: this.id,
      cropId: this.cropId,
      name: this.name,
      order: this.order,
      description: this.description,
      durationDays: this.durationDays,
      status: this.status
    };
  }

  /**
   * Factory desde fila de Supabase.
   * @param {Object} row
   * @returns {PhenologicalStage}
   */
  static fromRow(row) {
    return new PhenologicalStage({
      id: row.id,
      cropId: row.crop_id,
      name: row.name,
      order: row.stage_order ?? row.order,
      description: row.description ?? null,
      durationDays: row.duration_days ?? null,
      status: row.status ?? 'active'
    });
  }
}

/**
 * CropRequirement.js
 * Entidad: Requerimiento nutricional de un cultivo por etapa y rendimiento.
 * Representa los valores de la tabla fert_calc_requirements.
 */
import { CALCULATION_METHODOLOGY } from '../types/fertilization-calc.types.js';
import { InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} CropRequirementData
 * @property {string} id - UUID
 * @property {string} cropId - UUID del cultivo
 * @property {string} [stageId] - UUID de la etapa fenológica (null = requerimiento total del ciclo)
 * @property {string} nutrientCode - Código del nutriente
 * @property {number} amountKgHa - Requerimiento en kg/ha
 * @property {number} [minAmountKgHa] - Mínimo recomendado
 * @property {number} [maxAmountKgHa] - Máximo recomendado
 * @property {number} [referenceYield] - Rendimiento de referencia en t/ha (para escalar)
 * @property {string} [methodology] - Metodología de cálculo
 * @property {string} [source] - Fuente bibliográfica
 * @property {string} [status] - active|inactive
 */

export class CropRequirement {
  /** @param {CropRequirementData} data */
  constructor({
    id,
    cropId,
    stageId = null,
    nutrientCode,
    amountKgHa,
    minAmountKgHa = null,
    maxAmountKgHa = null,
    referenceYield = null,
    methodology = CALCULATION_METHODOLOGY.EXTRACTION,
    source = null,
    status = 'active',
    // Campos extendidos 039 — opcionales
    productionSystem = null,
    variety = null,
    yieldMin = null,
    yieldMax = null,
    unit = 'kg/ha',
    distributionPct = null,
    sourceAuthor = null,
    sourceYear = null,
    sourceDocument = null,
    sourcePage = null,
    observations = null,
    version = '1.0.0',
    isActive = true,
    companyId = null
  }) {
    if (!id) throw new InvalidInputError('CropRequirement: id es requerido.');
    if (!cropId) throw new InvalidInputError('CropRequirement: cropId es requerido.');
    if (!nutrientCode) throw new InvalidInputError('CropRequirement: nutrientCode es requerido.');
    if (typeof amountKgHa !== 'number' || amountKgHa < 0) {
      throw new InvalidInputError(
        `CropRequirement: amountKgHa debe ser un número >= 0 (recibido: ${amountKgHa}).`,
        { cropId, nutrientCode, amountKgHa }
      );
    }

    this.id = id;
    this.cropId = cropId;
    this.stageId = stageId;
    this.nutrientCode = nutrientCode;
    this.amountKgHa = amountKgHa;
    this.minAmountKgHa = minAmountKgHa;
    this.maxAmountKgHa = maxAmountKgHa;
    this.referenceYield = referenceYield;
    this.methodology = methodology;
    this.source = source;
    this.status = status;
    this.productionSystem = productionSystem;
    this.variety = variety;
    this.yieldMin = yieldMin;
    this.yieldMax = yieldMax;
    this.unit = unit;
    this.distributionPct = distributionPct;
    this.sourceAuthor = sourceAuthor;
    this.sourceYear = sourceYear;
    this.sourceDocument = sourceDocument;
    this.sourcePage = sourcePage;
    this.observations = observations;
    this.version = version;
    this.isActive = isActive;
    this.companyId = companyId;
  }

  /** @returns {boolean} Si es un requerimiento total del ciclo (sin etapa específica) */
  get isFullCycle() {
    return this.stageId === null;
  }

  /**
   * Escala el requerimiento a un rendimiento objetivo distinto al de referencia.
   * Si no hay rendimiento de referencia, devuelve el valor sin escalar.
   * @param {number} targetYield - Rendimiento objetivo en t/ha
   * @returns {number} Requerimiento ajustado en kg/ha
   */
  scaleToYield(targetYield) {
    if (!this.referenceYield || this.referenceYield <= 0) return this.amountKgHa;
    return (this.amountKgHa / this.referenceYield) * targetYield;
  }

  /**
   * Serializa a objeto plano.
   * @returns {CropRequirementData}
   */
  toObject() {
    return {
      id: this.id,
      cropId: this.cropId,
      stageId: this.stageId,
      nutrientCode: this.nutrientCode,
      amountKgHa: this.amountKgHa,
      minAmountKgHa: this.minAmountKgHa,
      maxAmountKgHa: this.maxAmountKgHa,
      referenceYield: this.referenceYield,
      methodology: this.methodology,
      source: this.source,
      status: this.status
    };
  }

  /** @returns {string} */
  toString() {
    return `CropRequirement(${this.nutrientCode}: ${this.amountKgHa} kg/ha${this.referenceYield ? ` @ ${this.referenceYield}t/ha` : ''})`;
  }

  /**
   * Factory desde fila de Supabase.
   * @param {Object} row
   * @returns {CropRequirement}
   */
  static fromRow(row) {
    return new CropRequirement({
      id: row.id,
      cropId: row.crop_id,
      stageId: row.stage_id ?? null,
      nutrientCode: row.nutrient_code,
      amountKgHa: row.amount_kg_ha,
      minAmountKgHa: row.min_amount_kg_ha ?? null,
      maxAmountKgHa: row.max_amount_kg_ha ?? null,
      referenceYield: row.reference_yield ?? null,
      methodology: row.methodology ?? CALCULATION_METHODOLOGY.EXTRACTION,
      source: row.source ?? null,
      status: row.status ?? 'active'
    });
  }
}

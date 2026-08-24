/**
 * SoilAnalysis.js
 * Entidad: Análisis de suelo completo.
 * Contiene pH, MO, CEC, textura y valores de nutrientes.
 */
import { InvalidSoilAnalysisError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} SoilAnalysisData
 * @property {string} id - UUID del análisis
 * @property {string} [companyId] - UUID de la empresa
 * @property {string} [loteId] - UUID del lote
 * @property {number} ph - pH del suelo (0-14)
 * @property {number} [organicMatter] - Materia orgánica (%)
 * @property {number} [cec] - CEC - Capacidad de Intercambio Catiónico (cmol/kg)
 * @property {string} [texture] - Textura: 'sandy'|'loamy'|'clay'|'silty'|'sandy_loam'|...
 * @property {Record<string, {value: number, unit: string}>} nutrients - Nutrientes analizados
 * @property {string} [labName] - Nombre del laboratorio
 * @property {Date|string} [sampleDate] - Fecha de la muestra
 * @property {Date|string} [reportDate] - Fecha del informe
 * @property {string} [reportCode] - Código del reporte de laboratorio
 * @property {Record<string, unknown>} [metadata]
 */

export class SoilAnalysis {
  /** @param {SoilAnalysisData} data */
  constructor({
    id,
    companyId = null,
    loteId = null,
    ph,
    organicMatter = null,
    cec = null,
    texture = null,
    nutrients = {},
    labName = null,
    sampleDate = null,
    reportDate = null,
    reportCode = null,
    metadata = {}
  }) {
    if (!id) throw new InvalidSoilAnalysisError('SoilAnalysis: id es requerido.');
    if (ph === undefined || ph === null) {
      throw new InvalidSoilAnalysisError('SoilAnalysis: pH es requerido.');
    }
    if (ph < 0 || ph > 14) {
      throw new InvalidSoilAnalysisError(
        `SoilAnalysis: pH debe estar entre 0 y 14 (recibido: ${ph}).`,
        { ph }
      );
    }
    if (organicMatter !== null && (organicMatter < 0 || organicMatter > 100)) {
      throw new InvalidSoilAnalysisError(
        `SoilAnalysis: Materia orgánica debe estar entre 0 y 100% (recibido: ${organicMatter}).`
      );
    }
    if (cec !== null && cec < 0) {
      throw new InvalidSoilAnalysisError(`SoilAnalysis: CEC debe ser >= 0 (recibido: ${cec}).`);
    }

    this.id = id;
    this.companyId = companyId;
    this.loteId = loteId;
    this.ph = ph;
    this.organicMatter = organicMatter;
    this.cec = cec;
    this.texture = texture;
    this.nutrients = { ...nutrients };
    this.labName = labName;
    this.sampleDate = sampleDate ? new Date(sampleDate) : null;
    this.reportDate = reportDate ? new Date(reportDate) : null;
    this.reportCode = reportCode;
    this.metadata = metadata;
  }

  /** @returns {boolean} Si el pH es ácido (< 6.0) */
  get isAcidic() {
    return this.ph < 6.0;
  }

  /** @returns {boolean} Si el pH es neutro (6.0-7.5) */
  get isNeutral() {
    return this.ph >= 6.0 && this.ph <= 7.5;
  }

  /** @returns {boolean} Si el pH es alcalino (> 7.5) */
  get isAlkaline() {
    return this.ph > 7.5;
  }

  /**
   * Obtiene el valor de un nutriente específico del análisis.
   * @param {string} nutrientCode
   * @returns {{ value: number, unit: string } | null}
   */
  getNutrient(nutrientCode) {
    return this.nutrients[nutrientCode] ?? null;
  }

  /**
   * Verifica si el análisis contiene datos de un nutriente.
   * @param {string} nutrientCode
   * @returns {boolean}
   */
  hasNutrient(nutrientCode) {
    return nutrientCode in this.nutrients && this.nutrients[nutrientCode] !== null;
  }

  /**
   * Serializa a objeto plano.
   * @returns {SoilAnalysisData}
   */
  toObject() {
    return {
      id: this.id,
      companyId: this.companyId,
      loteId: this.loteId,
      ph: this.ph,
      organicMatter: this.organicMatter,
      cec: this.cec,
      texture: this.texture,
      nutrients: { ...this.nutrients },
      labName: this.labName,
      sampleDate: this.sampleDate?.toISOString() ?? null,
      reportDate: this.reportDate?.toISOString() ?? null,
      reportCode: this.reportCode,
      metadata: this.metadata
    };
  }

  /** @returns {string} */
  toString() {
    return `SoilAnalysis(pH: ${this.ph}, MO: ${this.organicMatter ?? 'N/D'}%, CEC: ${this.cec ?? 'N/D'})`;
  }

  /**
   * Factory desde fila de Supabase.
   * @param {Object} row
   * @returns {SoilAnalysis}
   */
  static fromRow(row) {
    return new SoilAnalysis({
      id: row.id,
      companyId: row.company_id ?? null,
      loteId: row.lote_id ?? null,
      ph: row.ph,
      organicMatter: row.organic_matter ?? null,
      cec: row.cec ?? null,
      texture: row.texture ?? null,
      nutrients: row.nutrients ?? {},
      labName: row.lab_name ?? null,
      sampleDate: row.sample_date ?? null,
      reportDate: row.report_date ?? null,
      reportCode: row.report_code ?? null,
      metadata: row.metadata ?? {}
    });
  }

  /**
   * Crea un SoilAnalysis mínimo para casos sin análisis de suelo disponible.
   * Usa valores moderados por defecto.
   * @param {string} [id]
   * @returns {SoilAnalysis}
   */
  static createDefault(id = 'default-soil-analysis') {
    return new SoilAnalysis({
      id,
      ph: 6.5,
      organicMatter: 2.0,
      cec: 15,
      texture: 'loamy',
      nutrients: {}
    });
  }
}

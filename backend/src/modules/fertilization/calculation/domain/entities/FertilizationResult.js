/**
 * FertilizationResult.js
 * Entidad: Resultado completo de un cálculo de fertilización.
 * Contiene requerimientos, ajustes, balance, fertilizantes, warnings y trazabilidad.
 * Diseñada para ser serializable e inmutable como snapshot.
 */
import { ENGINE_VERSION } from '../types/fertilization-calc.types.js';

/**
 * @typedef {Object} NutrientBalance
 * @property {string} nutrientCode
 * @property {number} requirement - Requerimiento base (kg/ha)
 * @property {number} soilContribution - Aporte del suelo (kg/ha)
 * @property {number} netDemand - Demanda neta = requirement - soilContribution
 * @property {number} effectiveDemand - Demanda efectiva (ajustada por eficiencia)
 * @property {number} applied - Total aplicado con los fertilizantes seleccionados (kg/ha)
 * @property {number} balance - applied - effectiveDemand (+ = exceso, - = déficit)
 * @property {number} efficiency - Factor de eficiencia usado (0-1)
 * @property {string} [soilLevel] - Clasificación del nivel en suelo
 */

/**
 * @typedef {Object} CalculationWarning
 * @property {string} type - Tipo de advertencia (ver WARNING_TYPE)
 * @property {string} message - Mensaje descriptivo
 * @property {string} [nutrientCode] - Nutriente afectado (si aplica)
 * @property {'low'|'medium'|'high'} severity - Gravedad
 */

/**
 * @typedef {Object} AppliedRuleInfo
 * @property {string} ruleId
 * @property {string} ruleName
 * @property {boolean} matched - Si la condición se cumplió
 * @property {string[]} actionsExecuted - Acciones ejecutadas
 */

/**
 * @typedef {Object} FertilizationResultData
 * @property {string} id - UUID del resultado
 * @property {string} companyId
 * @property {string} cropId
 * @property {string} cropName
 * @property {string} [stageId]
 * @property {string} [stageName]
 * @property {number} [targetYield] - Rendimiento objetivo (t/ha)
 * @property {number} areaHa - Área del lote (ha)
 * @property {string} methodology - Metodología usada
 * @property {NutrientBalance[]} nutrientBalances - Balance por nutriente
 * @property {Object[]} fertilizerDoses - Dosis de fertilizantes recomendadas
 * @property {Object[]} [userOverrides] - Ajustes manuales del usuario
 * @property {CalculationWarning[]} warnings - Advertencias
 * @property {AppliedRuleInfo[]} rulesApplied - Reglas evaluadas
 * @property {Object} calculationSnapshot - Copia inmutable de todos los parámetros
 * @property {string} calculationVersion - Versión del motor
 * @property {string} calculatedAt - ISO timestamp del cálculo
 * @property {Object} [metadata]
 */

export class FertilizationResult {
  /**
   * @param {FertilizationResultData} data
   */
  constructor({
    id,
    companyId,
    cropId,
    cropName,
    stageId = null,
    stageName = null,
    targetYield = null,
    areaHa,
    methodology,
    nutrientBalances = [],
    fertilizerDoses = [],
    userOverrides = [],
    warnings = [],
    rulesApplied = [],
    calculationSnapshot = {},
    calculationVersion = ENGINE_VERSION,
    calculatedAt = new Date().toISOString(),
    metadata = {}
  }) {
    this.id = id;
    this.companyId = companyId;
    this.cropId = cropId;
    this.cropName = cropName;
    this.stageId = stageId;
    this.stageName = stageName;
    this.targetYield = targetYield;
    this.areaHa = areaHa;
    this.methodology = methodology;
    this.nutrientBalances = [...nutrientBalances];
    this.fertilizerDoses = [...fertilizerDoses];
    this.userOverrides = [...userOverrides];
    this.warnings = [...warnings];
    this.rulesApplied = [...rulesApplied];
    this.calculationSnapshot = { ...calculationSnapshot };
    this.calculationVersion = calculationVersion;
    this.calculatedAt = calculatedAt;
    this.metadata = metadata;
  }

  // ─── Métricas derivadas ───────────────────────────────────────────────────

  /** @returns {CalculationWarning[]} Solo las advertencias críticas o altas */
  get criticalWarnings() {
    return this.warnings.filter((w) => w.severity === 'high');
  }

  /** @returns {NutrientBalance[]} Nutrientes con déficit (balance < 0) */
  get deficientNutrients() {
    return this.nutrientBalances.filter((nb) => nb.balance < -0.1);
  }

  /** @returns {NutrientBalance[]} Nutrientes con exceso significativo (> 10% sobre requerimiento) */
  get excessNutrients() {
    return this.nutrientBalances.filter((nb) => {
      if (nb.effectiveDemand <= 0) return false;
      return nb.balance > nb.effectiveDemand * 0.1;
    });
  }

  /** @returns {boolean} Si el resultado tiene advertencias de alta severidad */
  get hasHighSeverityWarnings() {
    return this.criticalWarnings.length > 0;
  }

  /**
   * Obtiene el balance de un nutriente específico.
   * @param {string} nutrientCode
   * @returns {NutrientBalance|null}
   */
  getNutrientBalance(nutrientCode) {
    return this.nutrientBalances.find((nb) => nb.nutrientCode === nutrientCode) ?? null;
  }

  /**
   * Obtiene el costo total estimado en kg de producto por hectárea.
   * @returns {number}
   */
  getTotalDoseKgHa() {
    return this.fertilizerDoses.reduce((sum, dose) => sum + (dose.doseKgHa ?? 0), 0);
  }

  /**
   * Serializa el resultado completo a objeto plano para persistencia.
   * @returns {FertilizationResultData}
   */
  toObject() {
    return {
      id: this.id,
      companyId: this.companyId,
      cropId: this.cropId,
      cropName: this.cropName,
      stageId: this.stageId,
      stageName: this.stageName,
      targetYield: this.targetYield,
      areaHa: this.areaHa,
      methodology: this.methodology,
      nutrientBalances: this.nutrientBalances.map((nb) => ({ ...nb })),
      fertilizerDoses: this.fertilizerDoses.map((d) => ({ ...d })),
      userOverrides: this.userOverrides.map((o) => ({ ...o })),
      warnings: this.warnings.map((w) => ({ ...w })),
      rulesApplied: this.rulesApplied.map((r) => ({ ...r })),
      calculationSnapshot: { ...this.calculationSnapshot },
      calculationVersion: this.calculationVersion,
      calculatedAt: this.calculatedAt,
      metadata: this.metadata
    };
  }

  /**
   * Alias de toObject() para compatibilidad con engine serializers.
   * @returns {FertilizationResultData}
   */
  toJSON() {
    return this.toObject();
  }

  /**
   * Genera un snapshot inmutable de todos los parámetros del cálculo.
   * @returns {Object}
   */
  toSnapshot() {
    return {
      ...this.toObject(),
      snapshotAt: new Date().toISOString(),
      engineVersion: this.calculationVersion
    };
  }

  /**
   * @returns {boolean} Si el resultado no tiene déficits significativos
   */
  isSuccess() {
    return this.deficientNutrients.length === 0;
  }

  /**
   * @returns {Array<{ nutrientCode: string, surplus_kg_ha: number }>}
   *   Nutrientes con déficit (balance < 0)
   */
  getDeficits() {
    return this.nutrientBalances
      .filter((nb) => nb.balance < -0.1)
      .map((nb) => ({ nutrientCode: nb.nutrientCode, surplus_kg_ha: nb.balance }));
  }

  /**
   * @returns {Array<{ nutrientCode: string, surplus_kg_ha: number }>}
   *   Nutrientes con exceso significativo
   */
  getSurpluses() {
    return this.nutrientBalances
      .filter((nb) => {
        if ((nb.effectiveDemand ?? 0) <= 0) return false;
        return nb.balance > nb.effectiveDemand * 0.1;
      })
      .map((nb) => ({ nutrientCode: nb.nutrientCode, surplus_kg_ha: nb.balance }));
  }

  /** @returns {string} */
  toString() {
    return `FertilizationResult(${this.cropName}/${this.stageName ?? 'ciclo completo'} - ${this.calculatedAt})`;
  }

  /**
   * Factory desde objeto plano.
   * @param {FertilizationResultData} data
   * @returns {FertilizationResult}
   */
  static from(data) {
    return new FertilizationResult(data);
  }
}

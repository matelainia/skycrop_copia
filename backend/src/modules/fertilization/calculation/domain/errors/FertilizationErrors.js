/**
 * FertilizationErrors.js
 * Errores específicos del motor de cálculo de fertilización.
 * Todos extienden AppError para mantener consistencia con el sistema de errores del backend.
 */

import { AppError } from '../../../../../shared/errors/AppErrors.js';

// ─── Códigos de error del motor ────────────────────────────────────────────────
export const CALC_ERROR_CODES = /** @type {const} */ ({
  INVALID_INPUT: 'CALC_INVALID_INPUT',
  MISSING_REQUIREMENT: 'CALC_MISSING_REQUIREMENT',
  INVALID_UNIT: 'CALC_INVALID_UNIT',
  UNKNOWN_NUTRIENT: 'CALC_UNKNOWN_NUTRIENT',
  INVALID_SOIL_ANALYSIS: 'CALC_INVALID_SOIL_ANALYSIS',
  RULE_NOT_FOUND: 'CALC_RULE_NOT_FOUND',
  RULE_CONFLICT: 'CALC_RULE_CONFLICT',
  FERTILIZER_NOT_FOUND: 'CALC_FERTILIZER_NOT_FOUND',
  NO_VALID_COMBINATION: 'CALC_NO_VALID_FERTILIZER_COMBINATION',
  NUTRIENT_EXCESS: 'CALC_NUTRIENT_EXCESS',
  NUTRIENT_DEFICIT: 'CALC_NUTRIENT_DEFICIT',
  INVALID_EFFICIENCY: 'CALC_INVALID_EFFICIENCY',
  UNKNOWN_METHODOLOGY: 'CALC_UNKNOWN_METHODOLOGY',
  CALCULATION_FAILED: 'CALC_CALCULATION_FAILED'
});

export class CalcInvalidInputError extends AppError {
  constructor(message, details = null) {
    super(message, 400, CALC_ERROR_CODES.INVALID_INPUT);
    this.details = details;
  }
}

export class CalcMissingRequirementError extends AppError {
  constructor(cropId, stageId, nutrientCode) {
    super(
      `Sin requerimiento nutricional para cultivo=${cropId}, etapa=${stageId}, nutriente=${nutrientCode}`,
      422,
      CALC_ERROR_CODES.MISSING_REQUIREMENT
    );
    this.cropId = cropId;
    this.stageId = stageId;
    this.nutrientCode = nutrientCode;
  }
}

export class CalcInvalidUnitError extends AppError {
  constructor(unit, context = '') {
    super(
      `Unidad inválida o no soportada: "${unit}"${context ? ` (${context})` : ''}`,
      400,
      CALC_ERROR_CODES.INVALID_UNIT
    );
    this.unit = unit;
  }
}

export class CalcUnknownNutrientError extends AppError {
  constructor(code) {
    super(`Nutriente desconocido: "${code}"`, 400, CALC_ERROR_CODES.UNKNOWN_NUTRIENT);
    this.nutrientCode = code;
  }
}

export class CalcInvalidSoilAnalysisError extends AppError {
  constructor(message, details = null) {
    super(message, 400, CALC_ERROR_CODES.INVALID_SOIL_ANALYSIS);
    this.details = details;
  }
}

export class CalcRuleNotFoundError extends AppError {
  constructor(ruleId) {
    super(`Regla agronómica no encontrada: ${ruleId}`, 404, CALC_ERROR_CODES.RULE_NOT_FOUND);
    this.ruleId = ruleId;
  }
}

export class CalcRuleConflictError extends AppError {
  constructor(message, conflictingRules = []) {
    super(message, 422, CALC_ERROR_CODES.RULE_CONFLICT);
    this.conflictingRules = conflictingRules;
  }
}

export class CalcFertilizerNotFoundError extends AppError {
  constructor(fertilizerId) {
    super(
      `Fertilizante no encontrado: ${fertilizerId}`,
      404,
      CALC_ERROR_CODES.FERTILIZER_NOT_FOUND
    );
    this.fertilizerId = fertilizerId;
  }
}

export class CalcNoValidCombinationError extends AppError {
  constructor(missingNutrients = []) {
    super(
      `No se encontró combinación válida de fertilizantes para cubrir: ${missingNutrients.join(', ')}`,
      422,
      CALC_ERROR_CODES.NO_VALID_COMBINATION
    );
    this.missingNutrients = missingNutrients;
  }
}

export class CalcInvalidEfficiencyError extends AppError {
  constructor(value, context = '') {
    super(
      `Eficiencia fuera de rango (0-1): ${value}${context ? ` (${context})` : ''}`,
      400,
      CALC_ERROR_CODES.INVALID_EFFICIENCY
    );
    this.value = value;
  }
}

export class CalcUnknownMethodologyError extends AppError {
  constructor(methodology) {
    super(`Metodología desconocida: "${methodology}"`, 400, CALC_ERROR_CODES.UNKNOWN_METHODOLOGY);
    this.methodology = methodology;
  }
}

export class CalcCalculationFailedError extends AppError {
  constructor(message, cause = null) {
    super(`Error en motor de cálculo: ${message}`, 500, CALC_ERROR_CODES.CALCULATION_FAILED);
    this.cause = cause;
  }
}

// ─── Alias para compatibilidad interna de entidades y value objects ──────────
export {
  CalcInvalidInputError as InvalidInputError,
  CalcMissingRequirementError as MissingRequirementError,
  CalcInvalidUnitError as InvalidUnitError,
  CalcUnknownNutrientError as UnknownNutrientError,
  CalcInvalidSoilAnalysisError as InvalidSoilAnalysisError,
  CalcRuleNotFoundError as RuleNotFoundError,
  CalcRuleConflictError as RuleConflictError,
  CalcFertilizerNotFoundError as FertilizerNotFoundError,
  CalcNoValidCombinationError as NoValidCombinationError,
  CalcInvalidEfficiencyError as InvalidEfficiencyError,
  CalcUnknownMethodologyError as UnknownMethodologyError,
  CalcCalculationFailedError as CalculationFailedError
};

export class InvalidFertilizerError extends AppError {
  constructor(message, details = null) {
    super(message, 400, CALC_ERROR_CODES.FERTILIZER_NOT_FOUND);
    this.details = details;
  }
}

export class InvalidRuleError extends AppError {
  constructor(message, details = null) {
    super(message, 400, CALC_ERROR_CODES.RULE_CONFLICT);
    this.details = details;
  }
}

export class IncompatibleUnitsError extends AppError {
  constructor(unit1, unit2) {
    super(`Unidades incompatibles: "${unit1}" y "${unit2}"`, 400, CALC_ERROR_CODES.INVALID_UNIT);
    this.unit1 = unit1;
    this.unit2 = unit2;
  }
}

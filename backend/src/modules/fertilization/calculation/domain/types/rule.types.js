/**
 * rule.types.js
 * Tipos y constantes del sistema de reglas agronómicas.
 */

// ─── Operadores de condición ──────────────────────────────────────────────────

/**
 * Operadores soportados por el RuleEvaluator para evaluar condiciones.
 * @enum {string}
 */
export const RULE_OPERATOR = /** @type {const} */ ({
  LESS_THAN: 'lt',
  LESS_THAN_OR_EQUAL: 'lte',
  GREATER_THAN: 'gt',
  GREATER_THAN_OR_EQUAL: 'gte',
  EQUAL: 'eq',
  NOT_EQUAL: 'neq',
  BETWEEN: 'between', // { min, max } inclusive
  IN: 'in', // value debe estar en el array
  NOT_IN: 'not_in',
  CONTAINS: 'contains', // Para strings o arrays
  IS_NULL: 'is_null',
  IS_NOT_NULL: 'is_not_null'
});

// ─── Tipos de acción de regla ─────────────────────────────────────────────────

/**
 * Tipo de acción que ejecuta una regla cuando su condición se cumple.
 * @enum {string}
 */
export const RULE_ACTION_TYPE = /** @type {const} */ ({
  /** Ajustar el requerimiento nutricional de un nutriente (multiplicador) */
  ADJUST_REQUIREMENT: 'adjust_requirement',
  /** Ajustar el factor de eficiencia de un nutriente */
  ADJUST_EFFICIENCY: 'adjust_efficiency',
  /** Establecer el factor de corrección de suelo */
  SET_SOIL_CORRECTION: 'set_soil_correction',
  /** Excluir un nutriente del cálculo */
  EXCLUDE_NUTRIENT: 'exclude_nutrient',
  /** Emitir una advertencia sin modificar el cálculo */
  EMIT_WARNING: 'emit_warning',
  /** Reemplazar el valor calculado por un valor fijo */
  SET_FIXED_VALUE: 'set_fixed_value',
  /** Limitar el valor máximo de un nutriente */
  CAP_MAX_VALUE: 'cap_max_value',
  /** Establecer el mínimo valor de un nutriente */
  SET_MIN_VALUE: 'set_min_value'
});

// ─── Campos del contexto de evaluación ───────────────────────────────────────

/**
 * Campos disponibles en el contexto de evaluación de reglas.
 * Cada campo es una propiedad que el RuleEvaluator puede leer del contexto.
 * @enum {string}
 */
export const RULE_CONTEXT_FIELD = /** @type {const} */ ({
  // Cultivo
  CROP_ID: 'crop_id',
  CROP_NAME: 'crop_name',
  STAGE_ID: 'stage_id',
  STAGE_NAME: 'stage_name',
  STAGE_ORDER: 'stage_order',
  // Rendimiento y área
  TARGET_YIELD: 'target_yield',
  AREA_HA: 'area_ha',
  // Suelo
  SOIL_PH: 'soil_ph',
  SOIL_OM: 'soil_om', // Materia orgánica %
  SOIL_CEC: 'soil_cec', // CEC meq/100g
  SOIL_TEXTURE: 'soil_texture',
  // Nutrientes del suelo (formato: soil_n, soil_p, soil_k, etc.)
  SOIL_NUTRIENT: 'soil_nutrient', // prefijo, se combina con el código del nutriente
  // Nutriente objetivo de la regla
  NUTRIENT_CODE: 'nutrient_code',
  // Empresa / usuario
  COMPANY_ID: 'company_id',
  USER_ID: 'user_id',
  // Metodología
  METHODOLOGY: 'methodology'
});

// ─── Alcance de una regla ─────────────────────────────────────────────────────

/**
 * Define quién puede ver/usar la regla.
 * @enum {string}
 */
export const RULE_SCOPE = /** @type {const} */ ({
  GLOBAL: 'global', // Visible para todas las empresas (SkyCrop defaults)
  COMPANY: 'company', // Solo para la empresa propietaria
  USER: 'user' // Solo para el usuario propietario
});

// ─── Estado de regla ──────────────────────────────────────────────────────────

/** @enum {string} Estado de una regla */
export const RULE_STATUS = /** @type {const} */ ({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DEPRECATED: 'deprecated',
  DRAFT: 'draft'
});

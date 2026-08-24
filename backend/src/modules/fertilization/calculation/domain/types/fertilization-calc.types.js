/**
 * fertilization-calc.types.js
 * Tipos y constantes del motor de cálculo de fertilización.
 */

// ─── Metodologías de cálculo ───────────────────────────────────────────────────
export const METHODOLOGY = /** @type {const} */ ({
  EXTRACTION: 'extraction',
  STAGE_FIXED: 'stage_fixed',
  STAGE_YIELD: 'stage_yield',
  BALANCE: 'balance'
});

/** Alias para compatibilidad con entidades */
export const CALCULATION_METHODOLOGY = METHODOLOGY;

// ─── Estado de cultivos ────────────────────────────────────────────────────────
export const CROP_STATUS = /** @type {const} */ ({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft'
});

// ─── Tipos de fertilizante ────────────────────────────────────────────────────
export const FERTILIZER_TYPE = /** @type {const} */ ({
  SIMPLE: 'simple',
  COMPOUND: 'compound',
  COMPLEX: 'complex',
  ORGANIC: 'organic',
  FOLIAR: 'foliar',
  FERTIGATION: 'fertigation'
});

// ─── Clasificación de nutrientes en suelo ─────────────────────────────────────
export const SOIL_NUTRIENT_LEVEL = /** @type {const} */ ({
  VERY_LOW: 'very_low',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  VERY_HIGH: 'very_high',
  EXCESS: 'excess'
});

export const SOIL_CLASSIFICATION = SOIL_NUTRIENT_LEVEL; // alias

export const SOIL_CLASSIFICATION_LABELS = {
  very_low: 'Muy Bajo',
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  very_high: 'Muy Alto',
  excess: 'Exceso'
};

/**
 * Factores de corrección según nivel nutricional en suelo.
 * Factor > 1: nivel bajo → aplicar más. Factor < 1: nivel alto → aplicar menos.
 */
export const SOIL_CORRECTION_FACTORS = /** @type {Record<string, number>} */ ({
  very_low: 1.5,
  low: 1.3,
  medium: 1.0,
  high: 0.7,
  very_high: 0.4,
  excess: 0.0
});

// ─── Factores de conversión nutriente ─────────────────────────────────────────
export const NUTRIENT_CONVERSION_FACTORS = /** @type {const} */ ({
  // Fósforo: P ↔ P₂O₅
  P_TO_P2O5: 2.2914,
  P2O5_TO_P: 0.4364,
  // Potasio: K ↔ K₂O
  K_TO_K2O: 1.2046,
  K2O_TO_K: 0.8301,
  // Calcio: Ca ↔ CaO
  Ca_TO_CaO: 1.3992,
  CaO_TO_Ca: 0.7147,
  // Magnesio: Mg ↔ MgO
  Mg_TO_MgO: 1.6583,
  MgO_TO_Mg: 0.603,
  // Azufre: S ↔ SO₄
  S_TO_SO4: 3.0,
  SO4_TO_S: 0.3333
});

// ─── Códigos de nutrientes disponibles ────────────────────────────────────────
export const ALL_NUTRIENT_CODES = Object.freeze([
  'N',
  'P',
  'P2O5',
  'K',
  'K2O',
  'Ca',
  'Mg',
  'S',
  'Fe',
  'Mn',
  'Zn',
  'Cu',
  'B',
  'Mo',
  'Cl'
]);

// ─── Clasificación de pH ───────────────────────────────────────────────────────
export const PH_CLASSIFICATION = /** @type {const} */ ({
  STRONGLY_ACID: 'strongly_acid',
  MODERATELY_ACID: 'moderately_acid',
  SLIGHTLY_ACID: 'slightly_acid',
  NEUTRAL: 'neutral',
  SLIGHTLY_ALKALINE: 'slightly_alkaline',
  MODERATELY_ALKALINE: 'moderately_alkaline'
});

export const BALANCE_STATUS = /** @type {const} */ ({
  DEFICIT: 'deficit',
  COVERED: 'covered',
  SURPLUS: 'surplus'
});

export const RULE_ACTION_TYPES = /** @type {const} */ ({
  CORRECTION_FACTOR: 'correction_factor',
  WARNING: 'warning',
  SET_EFFICIENCY: 'set_efficiency',
  ADD_REQUIREMENT: 'add_requirement',
  BLOCK: 'block'
});

export const SELECTION_STRATEGY = /** @type {const} */ ({
  GREEDY: 'greedy',
  OPTIMIZATION: 'optimization',
  USER_PREFERENCE: 'user_preference'
});

// ─── Prioridades de reglas ────────────────────────────────────────────────────
export const RULE_PRIORITY = /** @type {const} */ ({
  GLOBAL: 1,
  COMPANY: 5,
  USER: 10
});

export const ENGINE_VERSION = '1.0.0';

export const CALC_TOLERANCES = {
  NUTRIENT_BALANCE_TOLERANCE_KG_HA: 0.5,
  MAX_SURPLUS_PERCENT: 20
};

export const DEFAULT_EFFICIENCIES = {
  N: { granular: 0.65, liquid: 0.7, foliar: 0.85 },
  P2O5: { granular: 0.25, liquid: 0.3, foliar: 0.4 },
  K2O: { granular: 0.7, liquid: 0.75, foliar: 0.8 },
  Ca: { granular: 0.6, liquid: 0.65, foliar: 0.55 },
  Mg: { granular: 0.65, liquid: 0.7, foliar: 0.65 },
  S: { granular: 0.7, liquid: 0.75, foliar: 0.75 },
  Fe: { granular: 0.2, liquid: 0.25, foliar: 0.7 },
  Mn: { granular: 0.25, liquid: 0.3, foliar: 0.75 },
  Zn: { granular: 0.25, liquid: 0.3, foliar: 0.75 },
  Cu: { granular: 0.3, liquid: 0.35, foliar: 0.7 },
  B: { granular: 0.5, liquid: 0.6, foliar: 0.8 },
  Mo: { granular: 0.5, liquid: 0.6, foliar: 0.8 }
};

export const DEFAULT_SOIL_AVAILABILITY = {
  N: 0.5,
  P2O5: 0.2,
  K2O: 0.8,
  Ca: 0.9,
  Mg: 0.85,
  S: 0.6
};

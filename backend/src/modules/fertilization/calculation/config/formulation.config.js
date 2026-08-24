/**
 * formulation.config.js
 * Configuración del FertilizationEngine (formulación).
 *
 * REGLA: ninguno de estos valores es una constante agronómica hardcodeada
 * en la lógica. Todos son configurables y pueden sobrescribirse por
 * petición (input.formulationConfig) o por configuración agronómica.
 *
 * El frontend NUNCA fija estos pesos: son parte de la configuración del motor.
 */

export const FORMULATION_CONFIG_VERSION = '1.0.0';

/**
 * Rangos de cobertura por nutriente (§5 del diseño).
 *   coverage < minPct            → déficit
 *   minPct ≤ coverage ≤ maxPct   → adecuado
 *   coverage > maxPct            → exceso
 */
export const DEFAULT_COVERAGE_RANGES = {
  minPct: 95,
  targetPct: 100,
  maxPct: 110
};

/**
 * Pesos de la función objetivo ponderada (§10):
 *   J = w_cost·Costo + w_dose·Dosis + w_deviation·DesviaciónNutricional
 *     + w_excess·PenalizaciónExceso
 *
 * Deben normalizarse (suman 1.0). Configurables, no fijados por el frontend.
 */
export const DEFAULT_OBJECTIVE_WEIGHTS = {
  cost: 0.3,
  deviation: 0.4,
  dose: 0.1,
  excess: 0.2
};

/** Tolerancias numéricas del solver (kg/ha). */
export const SOLVER_TOLERANCES = {
  /** Demanda menor a esto se considera cubierta sin fertilizante. */
  DEMAND_EPSILON_KG_HA: 0.01,
  /** Mejora mínima del objetivo para aceptar un movimiento del refinamiento. */
  OBJECTIVE_IMPROVEMENT_EPSILON: 1e-6
};

/** Límites de seguridad del refinamiento determinista. */
export const SOLVER_LIMITS = {
  MAX_REFINEMENT_ITERATIONS: 300,
  MAX_PRODUCTS: 10,
  /** Pasos relativos de ajuste por coordenada (fracciones de la dosis actual). */
  ADJUSTMENT_STEPS: [0.25, 0.1, 0.05, 0.02, 0.005]
};

/**
 * Eficiencia de fertilización (§22-23).
 * PREPARADA PERO INACTIVA por defecto: solo se aplica cuando la metodología
 * agronómica seleccionada lo indique. No se introducen factores inventados.
 */
export const EFFICIENCY_LAYER = {
  enabled: false,
  factors: null // ej: { N: 0.60, P2O5: 0.25, K2O: 0.60 } — debe provenir de metodología explícita
};

export const DEFAULT_FORMULATION_CONFIG = Object.freeze({
  configVersion: FORMULATION_CONFIG_VERSION,
  coverageRanges: { ...DEFAULT_COVERAGE_RANGES },
  objectiveWeights: { ...DEFAULT_OBJECTIVE_WEIGHTS },
  tolerances: { ...SOLVER_TOLERANCES },
  limits: { ...SOLVER_LIMITS },
  efficiency: { ...EFFICIENCY_LAYER }
});

/**
 * Combina la configuración por defecto con overrides parciales.
 * Ignora claves desconocidas para no inyectar configuración inválida.
 *
 * @param {Object} [overrides]
 * @returns {Object} configuración completa normalizada
 */
export function resolveFormulationConfig(overrides = {}) {
  if (!overrides || typeof overrides !== 'object') {
    return structuredClone(DEFAULT_FORMULATION_CONFIG);
  }
  const cfg = structuredClone(DEFAULT_FORMULATION_CONFIG);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  if (overrides.coverageRanges && typeof overrides.coverageRanges === 'object') {
    for (const key of ['minPct', 'targetPct', 'maxPct']) {
      const v = num(overrides.coverageRanges[key]);
      if (v !== null && v > 0 && v <= 200) cfg.coverageRanges[key] = v;
    }
    if (cfg.coverageRanges.minPct > cfg.coverageRanges.maxPct) {
      cfg.coverageRanges.minPct = cfg.coverageRanges.maxPct;
    }
  }

  if (overrides.objectiveWeights && typeof overrides.objectiveWeights === 'object') {
    let sum = 0;
    const next = {};
    for (const key of ['cost', 'deviation', 'dose', 'excess']) {
      const v = num(overrides.objectiveWeights[key]);
      next[key] = v !== null && v >= 0 ? v : cfg.objectiveWeights[key];
      sum += next[key];
    }
    // Renormalizar para mantener J acotado entre estrategias
    if (sum > 0) {
      for (const key of Object.keys(next)) next[key] = next[key] / sum;
      cfg.objectiveWeights = next;
    }
  }

  if (overrides.efficiency && typeof overrides.efficiency === 'object') {
    cfg.efficiency.enabled = Boolean(overrides.efficiency.enabled);
    if (overrides.efficiency.factors && typeof overrides.efficiency.factors === 'object') {
      cfg.efficiency.factors = { ...overrides.efficiency.factors };
    }
  }

  return cfg;
}

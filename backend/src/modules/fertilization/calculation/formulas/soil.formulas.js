/**
 * soil.formulas.js
 * Fórmulas para diagnóstico y clasificación de suelo.
 * Funciones puras — sin efectos secundarios.
 */
import {
  SOIL_NUTRIENT_LEVEL,
  SOIL_CORRECTION_FACTORS
} from '../domain/types/fertilization-calc.types.js';

// ─── Rangos de clasificación para nutrientes en suelo ────────────────────────
// Unidades: mg/kg (ppm) para P, K, S, micronutrientes; cmol/kg para Ca, Mg; % para N (MO)
// Estos valores son referencia general — pueden ser configurados por reglas.

/** @type {Record<string, {unit: string, thresholds: {level: string, max: number}[]}>} */
const SOIL_NUTRIENT_RANGES = {
  // Nitrógeno — se estima a partir de Materia Orgánica (MO %)
  // MO% × 0.05 × 10000 ≈ N disponible en kg/ha (aprox.)
  N: {
    unit: '%', // Materia orgánica %
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 1.0 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 2.0 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 3.5 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: 5.0 },
      { level: SOIL_NUTRIENT_LEVEL.VERY_HIGH, max: Infinity }
    ]
  },
  // Fósforo disponible (Bray II, Mehlich-3) — mg/kg
  P: {
    unit: 'mg/kg',
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 5 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 12 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 25 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: 50 },
      { level: SOIL_NUTRIENT_LEVEL.VERY_HIGH, max: 100 },
      { level: SOIL_NUTRIENT_LEVEL.EXCESS, max: Infinity }
    ]
  },
  // También para P2O5 (convertir antes de clasificar)
  P2O5: {
    unit: 'mg/kg',
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 11.5 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 27.5 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 57.3 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: 114.6 },
      { level: SOIL_NUTRIENT_LEVEL.VERY_HIGH, max: 229.1 },
      { level: SOIL_NUTRIENT_LEVEL.EXCESS, max: Infinity }
    ]
  },
  // Potasio intercambiable — cmol/kg (meq/100g)
  K: {
    unit: 'cmol/kg',
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 0.1 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 0.2 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 0.4 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: 0.8 },
      { level: SOIL_NUTRIENT_LEVEL.VERY_HIGH, max: Infinity }
    ]
  },
  K2O: {
    unit: 'cmol/kg',
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 0.12 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 0.24 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 0.48 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: 0.96 },
      { level: SOIL_NUTRIENT_LEVEL.VERY_HIGH, max: Infinity }
    ]
  },
  // Calcio intercambiable — cmol/kg
  Ca: {
    unit: 'cmol/kg',
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 2 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 5 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 10 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: 20 },
      { level: SOIL_NUTRIENT_LEVEL.VERY_HIGH, max: Infinity }
    ]
  },
  // Magnesio intercambiable — cmol/kg
  Mg: {
    unit: 'cmol/kg',
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 0.5 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 1.0 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 2.0 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: 4.0 },
      { level: SOIL_NUTRIENT_LEVEL.VERY_HIGH, max: Infinity }
    ]
  },
  // Azufre — mg/kg
  S: {
    unit: 'mg/kg',
    thresholds: [
      { level: SOIL_NUTRIENT_LEVEL.VERY_LOW, max: 5 },
      { level: SOIL_NUTRIENT_LEVEL.LOW, max: 10 },
      { level: SOIL_NUTRIENT_LEVEL.MEDIUM, max: 20 },
      { level: SOIL_NUTRIENT_LEVEL.HIGH, max: Infinity }
    ]
  }
};

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Clasifica el nivel de un nutriente en el suelo según sus rangos de referencia.
 *
 * @param {string} nutrientCode - Código del nutriente
 * @param {number} value - Valor del análisis
 * @param {string} [unit] - Unidad del análisis (informativa, no convierte)
 * @returns {{ classification: string, correctionFactor: number }}
 */
export function classifyNutrientLevel(nutrientCode, value) {
  const ranges = SOIL_NUTRIENT_RANGES[nutrientCode];

  if (!ranges) {
    // Nutriente sin rangos definidos → nivel medio por defecto
    return {
      classification: SOIL_NUTRIENT_LEVEL.MEDIUM,
      correctionFactor: SOIL_CORRECTION_FACTORS.medium
    };
  }

  for (const threshold of ranges.thresholds) {
    if (value <= threshold.max) {
      return {
        classification: threshold.level,
        correctionFactor: SOIL_CORRECTION_FACTORS[threshold.level] ?? 1.0
      };
    }
  }

  // Fallback: EXCESS si supera todos los umbrales
  return {
    classification: SOIL_NUTRIENT_LEVEL.EXCESS,
    correctionFactor: SOIL_CORRECTION_FACTORS.excess
  };
}

/**
 * Estima el aporte disponible del suelo en kg/ha para un nutriente.
 * Basado en el valor del análisis y factores de disponibilidad por textura/pH.
 *
 * @param {string} nutrientCode - Código del nutriente
 * @param {number} soilValue - Valor del análisis de suelo
 * @param {string} unit - Unidad del valor
 * @param {string} [texture] - Textura del suelo (sandy|loamy|clay|...)
 * @param {number} [ph] - pH del suelo
 * @returns {number} Aporte disponible estimado en kg/ha
 */
export function estimateSoilContribution(
  nutrientCode,
  soilValue,
  unit,
  texture = 'loamy',
  ph = 6.5
) {
  // Factor de disponibilidad base según nutriente y textura
  const availabilityFactors = {
    N: { sandy: 0.03, loamy: 0.04, clay: 0.05 },
    P: { sandy: 0.1, loamy: 0.12, clay: 0.08 },
    P2O5: { sandy: 0.1, loamy: 0.12, clay: 0.08 },
    K: { sandy: 0.15, loamy: 0.2, clay: 0.25 },
    K2O: { sandy: 0.15, loamy: 0.2, clay: 0.25 },
    Ca: { sandy: 0.2, loamy: 0.25, clay: 0.3 },
    Mg: { sandy: 0.2, loamy: 0.25, clay: 0.28 },
    S: { sandy: 0.15, loamy: 0.18, clay: 0.2 }
  };

  const textureGroup = ['sandy', 'loamy', 'clay'].includes(texture) ? texture : 'loamy';
  const factors = availabilityFactors[nutrientCode];
  if (!factors) return 0;

  let baseFactor = factors[textureGroup] ?? 0.15;

  // Ajuste por pH para Fósforo (disponibilidad máxima entre pH 6.0-7.0)
  if ((nutrientCode === 'P' || nutrientCode === 'P2O5') && (ph < 5.5 || ph > 7.5)) {
    baseFactor *= 0.5; // Reducir disponibilidad en pH extremos
  }

  // Para N: convertir MO% a disponibilidad estimada
  // Aproximación: N mineralizable ≈ MO(%) × 20 kg/ha/año
  if (nutrientCode === 'N' && unit === '%') {
    return soilValue * 20 * baseFactor;
  }

  // Para cationes en cmol/kg: convertir a kg/ha
  // Peso equivalente × cmol/kg × factor
  const cationWeights = { Ca: 200, Mg: 122, K: 391, K2O: 470 };
  if (unit === 'cmol/kg' || unit === 'meq/100g') {
    const weight = cationWeights[nutrientCode] ?? 100;
    // cmol/kg × peso_equivalente × factor_profundidad_suelo(≈1.5) × factor_disp
    return soilValue * (weight / 100) * 1.5 * baseFactor;
  }

  // Para mg/kg (ppm): conversion simple a kg/ha
  // 1 ppm = 2 kg/ha (approx., considerando densidad aparente 1 g/cm³, 20cm profundidad)
  return soilValue * 2 * baseFactor;
}

/**
 * Evalúa el pH del suelo y retorna advertencias agronómicas.
 * @param {number} ph - pH del suelo
 * @returns {{ level: string, warnings: string[] }}
 */
export function evaluateSoilPH(ph) {
  const warnings = [];
  let level = 'optimal';

  if (ph < 4.5) {
    level = 'very_acid';
    warnings.push(
      'pH extremadamente ácido: alta toxicidad de Al y Mn. Se requiere encalado urgente.'
    );
  } else if (ph < 5.5) {
    level = 'acid';
    warnings.push('pH ácido: disponibilidad de P, Ca, Mg reducida. Considere encalado.');
  } else if (ph < 6.0) {
    level = 'slightly_acid';
    warnings.push('pH ligeramente ácido: condiciones aceptables para la mayoría de cultivos.');
  } else if (ph <= 7.0) {
    level = 'optimal';
  } else if (ph <= 7.5) {
    level = 'slightly_alkaline';
    warnings.push(
      'pH ligeramente alcalino: posible reducción en disponibilidad de micronutrientes.'
    );
  } else if (ph <= 8.5) {
    level = 'alkaline';
    warnings.push('pH alcalino: baja disponibilidad de Zn, Fe, Mn, Cu, B. Usar formas queladas.');
  } else {
    level = 'very_alkaline';
    warnings.push(
      'pH muy alcalino: condiciones adversas. Considere corrección con azufre elemental.'
    );
  }

  return { level, warnings };
}

/**
 * Calcula el factor de disponibilidad de fósforo ajustado por pH.
 * @param {number} ph
 * @returns {number} Factor multiplicador (0-1)
 */
export function getPhosphorusAvailabilityFactor(ph) {
  // Disponibilidad máxima entre pH 6.0 y 7.0
  if (ph >= 6.0 && ph <= 7.0) return 1.0;
  if (ph < 4.0 || ph > 9.0) return 0.1;
  if (ph < 5.0) return 0.3;
  if (ph < 6.0) return 0.7 + (ph - 5.0) * 0.3;
  if (ph > 7.0 && ph <= 8.0) return 1.0 - (ph - 7.0) * 0.3;
  if (ph > 8.0) return 0.7 - (ph - 8.0) * 0.3;
  return 1.0;
}

/**
 * Convierte concentración mg/kg (ppm) a kg/ha en base a densidad aparente y profundidad de muestreo.
 * masa_suelo (t/ha) = 10,000 m² × (depthCm / 100) m × bulkDensity (t/m³)
 * kg/ha = mg/kg × (masa_suelo / 1000)
 */
export function mgKgToKgHa(mgKg, bulkDensity = 1.3, depthCm = 20) {
  const soilMassTonHa = 10000 * (depthCm / 100) * bulkDensity;
  return (mgKg * soilMassTonHa) / 1000;
}

/**
 * Convierte K intercambiable (cmol(+)/kg) a kg K/ha y kg K₂O/ha.
 * K peso molar = 39.10 g/mol (monovalente) -> 1 cmol/kg = 391 mg/kg.
 */
export function cmolKgKToKgHa(cmolKg, bulkDensity = 1.3, depthCm = 20) {
  const kMgKg = cmolKg * 391.0;
  const kKgHa = mgKgToKgHa(kMgKg, bulkDensity, depthCm);
  const k2oKgHa = kKgHa * 1.2046; // K -> K2O
  return { kKgHa, k2oKgHa };
}

export function classifyK(value) {
  return classifyNutrientLevel('K', value).classification;
}

export function classifyP(value) {
  return classifyNutrientLevel('P', value).classification;
}

export function classifyCa(value) {
  return classifyNutrientLevel('Ca', value).classification;
}

export function classifyMg(value) {
  return classifyNutrientLevel('Mg', value).classification;
}

export function classifyS(value) {
  return classifyNutrientLevel('S', value).classification;
}

export function classifyPH(ph) {
  return evaluateSoilPH(ph).level;
}

export function classifyOrganicMatter(omPercent) {
  return classifyNutrientLevel('N', omPercent).classification;
}

export function calculateSoilContribution(totalKgHa, availabilityFactor = 1.0) {
  return totalKgHa * availabilityFactor;
}

export function estimateNFromMO(omPercent) {
  // Aporte estimado de N a partir de MO (%): aprox 20 kg N/ha por cada 1% de MO
  return omPercent * 20;
}

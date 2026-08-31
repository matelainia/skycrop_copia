/**
 * ValidationEngine.js
 * Validación de entradas y resultados del motor de cálculo.
 */

import { z } from 'zod';
import {
  CalcInvalidInputError,
  CalcInvalidSoilAnalysisError
} from '../domain/errors/FertilizationErrors.js';
import { isValidUnit } from '../domain/value-objects/Unit.js';

// ─── Esquema de entrada del cálculo ───────────────────────────────────────────

/**
 * Fuente fertilizante registrada por el usuario (Paso 3).
 * La composición es dinámica: cualquier código de nutriente con % > 0.
 * Precio y disponibilidad son opcionales (§2 del diseño).
 */
const FertilizerSourceSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1, { message: 'El nombre del producto es requerido' }),
    composition: z
      .record(z.string(), z.number().nullable())
      .refine((comp) => Object.values(comp ?? {}).some((v) => typeof v === 'number' && v > 0), {
        message: 'La composición debe incluir al menos un nutriente con valor > 0'
      }),
    presentationKg: z.number().positive().nullable().optional(),
    pricePerUnit: z.number().positive().nullable().optional(),
    available: z.boolean().optional(),
    minDoseKgHa: z.number().positive().nullable().optional(),
    maxDoseKgHa: z.number().positive().nullable().optional(),
    masterFertilizerId: z.string().uuid().nullable().optional()
  })
  .refine(
    (s) => {
      const total = Object.values(s.composition ?? {}).reduce(
        (sum, v) => sum + (typeof v === 'number' && v > 0 ? v : 0),
        0
      );
      return total <= 100.01;
    },
    { message: 'La suma de la composición no puede superar 100%' }
  );

const SoilInlineSchema = z
  .object({
    pH: z.number().min(0).max(14).nullable().optional(),
    organicMatter: z.number().min(0).max(100).nullable().optional(),
    cec: z.number().min(0).nullable().optional(),
    texture: z.string().nullable().optional(),
    N: z.number().nullable().optional(),
    P: z.number().nullable().optional(),
    K: z.number().nullable().optional(),
    Ca: z.number().nullable().optional(),
    Mg: z.number().nullable().optional(),
    S: z.number().nullable().optional(),
    bulkDensity: z.number().nullable().optional(),
    samplingDepthCm: z.number().nullable().optional()
  })
  .passthrough()
  .optional()
  .nullable();

const CustomRequirementsSchema = z
  .record(z.string(), z.number().min(0).nullable())
  .optional()
  .nullable();

const RequirementDistributionsSchema = z
  .record(z.string(), z.number().min(0).max(100).nullable())
  .optional()
  .nullable();

const CalculationInputSchema = z.object({
  // cropId/stageId pueden ser UUID reales de fert_calc_* o ids legibles del frontend (cacao/vegetativo) — ambos aceptados
  cropId: z.string().min(1, { message: 'cropId es requerido' }),
  stageId: z.string().min(1, { message: 'stageId es requerido' }),
  targetYieldTHa: z
    .number({ required_error: 'targetYieldTHa es requerido' })
    .positive({ message: 'targetYieldTHa debe ser > 0' }),
  methodology: z
    .enum(['extraction', 'stage_fixed', 'stage_yield', 'balance', 'custom'])
    .optional()
    .nullable(),
  /** Fuente del requerimiento proveniente del Paso 2: skycrop_db | custom | extraction | balance */
  requirementSource: z
    .enum(['skycrop_db', 'custom', 'extraction', 'balance', 'stage_fixed'])
    .optional()
    .nullable(),
  /** Requerimientos nutricionales explícitos del Paso 2 cuando source = custom */
  customRequirements: CustomRequirementsSchema,
  /** Distribución % por nutriente para la aplicación actual (Paso 2) */
  requirementDistributions: RequirementDistributionsSchema,
  /** Meta de rendimiento + sistema productivo ampliados para trazabilidad */
  variety: z.string().nullable().optional(),
  productionSystem: z.string().nullable().optional(),
  soilAnalysisId: z.string().min(1).optional().nullable(),
  /** Análisis de suelo inline capturado en Paso 1 cuando aún no existe ID persistido */
  soilAnalysis: SoilInlineSchema,
  companyId: z.string().min(1).optional().nullable(),
  lotId: z.string().min(1).optional().nullable(),
  farmId: z.string().min(1).optional().nullable(),
  applicationMethod: z.enum(['granular', 'liquid', 'foliar']).default('granular'),
  /** Superficie del lote en hectáreas (para kg/lote y ajuste de bultos). */
  areaHa: z.number().positive().optional().nullable(),
  /** Densidad de siembra en plantas/ha (para dosis por planta). */
  plantsHa: z.number().positive().optional().nullable(),
  /**
   * Fuentes fertilizantes registradas por el usuario.
   * Cuando están presentes, el motor formula SOLO con ellas (Paso 3).
   */
  fertilizerSources: z.array(FertilizerSourceSchema).min(1).max(20).optional(),
  /** Overrides de configuración del motor (rangos de cobertura, pesos). */
  formulationConfig: z.record(z.any()).optional(),
  constraints: z
    .object({
      maxProducts: z.number().int().min(1).max(10).optional(),
      requiredProductIds: z.array(z.string().uuid()).optional(),
      excludedProductIds: z.array(z.string().uuid()).optional(),
      doseLimits: z
        .record(z.object({ min: z.number().optional(), max: z.number().optional() }))
        .optional()
    })
    .optional()
    .default({})
});

export class ValidationEngine {
  /**
   * Valida la entrada del cálculo de fertilización.
   *
   * @param {Object} input
   * @returns {Object} Datos validados y normalizados
   * @throws {CalcInvalidInputError}
   */
  validateInput(input) {
    const result = CalculationInputSchema.safeParse(input);
    if (!result.success) {
      throw new CalcInvalidInputError(
        'Datos de entrada inválidos para el cálculo de fertilización',
        result.error.format()
      );
    }
    return result.data;
  }

  /**
   * Valida que un análisis de suelo tenga datos coherentes.
   *
   * @param {import('../domain/entities/SoilAnalysis.js').SoilAnalysis} soilAnalysis
   * @throws {CalcInvalidSoilAnalysisError}
   */
  validateSoilAnalysis(soilAnalysis) {
    const errors = [];

    if (soilAnalysis.pH !== null) {
      if (soilAnalysis.pH < 0 || soilAnalysis.pH > 14)
        errors.push(`pH fuera de rango: ${soilAnalysis.pH}`);
    }
    if (soilAnalysis.organicMatter !== null) {
      if (soilAnalysis.organicMatter < 0 || soilAnalysis.organicMatter > 100)
        errors.push(`MO% fuera de rango: ${soilAnalysis.organicMatter}`);
    }
    if (soilAnalysis.cec !== null && soilAnalysis.cec < 0) {
      errors.push(`CEC negativa: ${soilAnalysis.cec}`);
    }
    // Validar unidades de nutrientes del suelo
    for (const nutrient of ['N', 'P', 'K', 'Ca', 'Mg', 'S']) {
      const data = soilAnalysis[nutrient];
      if (data && data.unit && !isValidUnit(data.unit)) {
        errors.push(`Unidad inválida para ${nutrient}: ${data.unit}`);
      }
      if (data && typeof data.value === 'number' && data.value < 0) {
        errors.push(`Valor negativo para ${nutrient}: ${data.value}`);
      }
    }

    if (errors.length > 0) {
      throw new CalcInvalidSoilAnalysisError(
        `Análisis de suelo con datos inválidos: ${errors.join('; ')}`,
        errors
      );
    }
  }

  /**
   * Valida el resultado del cálculo antes de guardarlo.
   *
   * @param {import('../domain/entities/FertilizationResult.js').FertilizationResult} result
   * @returns {{ valid: boolean, warnings: string[] }}
   */
  validateResult(result) {
    const warnings = [];

    if (!result.isSuccess()) {
      warnings.push('El resultado no fue completamente exitoso');
    }

    const deficits = result.getDeficits();
    if (deficits.length > 0) {
      deficits.forEach((d) => {
        warnings.push(
          `Déficit de ${d.nutrientCode}: ${Math.abs(d.surplus_kg_ha).toFixed(2)} kg/ha`
        );
      });
    }

    const surpluses = result.getSurpluses();
    if (surpluses.length > 0) {
      surpluses.forEach((s) => {
        warnings.push(`Excedente de ${s.nutrientCode}: ${s.surplus_kg_ha.toFixed(2)} kg/ha`);
      });
    }

    return { valid: deficits.length === 0, warnings };
  }
}

/**
 * fertilization.engine.formulation.integration.test.js
 * Test de integración de la rama de formulación del FertilizationEngine:
 * valida el pipeline completo validación → requerimientos → balance →
 * FormulationEngine → post-procesado comercial → resultado §28.
 *
 * Usa repositorios stub: los requerimientos provienen del "diagnóstico"
 * (como en producción, desde Supabase); las fuentes, del usuario.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock de AppErrors para evitar dependencia del shared/ en tests
vi.mock('../../../../../shared/errors/AppErrors.js', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode, code) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  }
}));

import { FertilizationEngine } from '../../engine/FertilizationEngine.js';
import { CalcInvalidInputError } from '../../domain/errors/FertilizationErrors.js';

const CROP_ID = '123e4567-e89b-12d3-a456-426614174000';
const STAGE_ID = '223e4567-e89b-12d3-a456-426614174001';

/** Requerimientos netos que "devolvería" el diagnóstico (kg/ha por t/ha). */
const DIAGNOSIS_REQUIREMENTS = [
  { nutrientCode: 'N', amountKgHa: 30, referenceYield: 1, methodology: 'extraction' }, // → 60
  { nutrientCode: 'P2O5', amountKgHa: 25, referenceYield: 1, methodology: 'extraction' }, // → 50
  { nutrientCode: 'K2O', amountKgHa: 40, referenceYield: 1, methodology: 'extraction' } // → 80
];

function buildEngine() {
  const repos = {
    cropRepo: {
      findById: async () => ({ id: CROP_ID, name: 'Cacao' }),
      findStageById: async () => ({ id: STAGE_ID, name: 'Producción' })
    },
    requirementRepo: {
      findByCropAndStage: async () => DIAGNOSIS_REQUIREMENTS
    },
    ruleRepo: { findActive: async () => [] },
    fertilizerRepo: { findActive: async () => [] },
    soilAnalysisRepo: {}
  };
  return new FertilizationEngine(repos);
}

const USER_SOURCES = [
  {
    name: 'MAP 12-24-0',
    composition: { N: 12, P2O5: 24 },
    presentationKg: 50,
    pricePerUnit: 0.9
  },
  {
    name: 'Urea 46-0-0',
    composition: { N: 46 },
    presentationKg: 50
  },
  {
    name: 'SOP 0-0-50-18S',
    composition: { K2O: 50, S: 18 },
    presentationKg: 50,
    pricePerUnit: 0.75
  }
];

const BASE_INPUT = {
  cropId: CROP_ID,
  stageId: STAGE_ID,
  targetYieldTHa: 2,
  methodology: 'extraction',
  applicationMethod: 'granular',
  areaHa: 10,
  plantsHa: 4000
};

describe('FertilizationEngine — rama formulación con fuentes del usuario', () => {
  it('formula con las fuentes registradas y produce el resultado §28 completo', async () => {
    const engine = buildEngine();
    const result = await engine.calculate({
      ...BASE_INPUT,
      fertilizerSources: USER_SOURCES
    });

    expect(result.formulation_status).toBe('feasible');
    expect(result.status).toBe('feasible');
    expect(result.canonical_unit).toBe('kg/ha');

    // El requerimiento proviene del diagnóstico (60/50/80), no se inventa
    expect(result.requirements.N).toBeCloseTo(60, 1);
    expect(result.requirements.P2O5).toBeCloseTo(50, 1);
    expect(result.requirements.K2O).toBeCloseTo(80, 1);

    // Solo productos usados; todos con dosis real > 0
    expect(result.products.length).toBeGreaterThanOrEqual(2);
    expect(result.products.length).toBeLessThanOrEqual(3);
    for (const p of result.products) {
      expect(p.actual_dose_kg_ha).toBeGreaterThan(0);
      // Bultos enteros coherentes con presentación y área
      if (p.total_packages !== null) {
        expect(Number.isInteger(p.total_packages)).toBe(true);
        expect(p.total_packages_kg).toBeCloseTo(p.total_packages * p.presentation_kg, 4);
        expect(p.actual_dose_kg_ha).toBeCloseTo(p.total_packages_kg / 10, 4);
      }
      // g/planta consistente
      expect(p.dose_g_plant).toBeCloseTo((p.actual_dose_kg_ha / 4000) * 1000, 1);
    }

    // Cobertura dentro del rango configurable 95–110%
    for (const b of Object.values(result.nutrient_balance)) {
      expect(b.coverage).toBeGreaterThanOrEqual(94.9);
      expect(['adequate', 'deficit', 'excess']).toContain(b.status);
    }

    // Costo solo de productos con precio (MAP 0.9, SOP 0.75; Urea sin precio)
    const mapProduct = result.products.find((p) => p.name.startsWith('MAP'));
    const ureaProduct = result.products.find((p) => p.name.startsWith('Urea'));
    expect(mapProduct.cost).not.toBeNull();
    expect(ureaProduct.cost).toBeNull();
    expect(result.total_cost).toBeCloseTo(
      result.products.reduce((s, p) => s + (p.cost ?? 0), 0),
      2
    );

    // Snapshot inmutable (§25)
    expect(result.snapshot.nutrient_requirements.N.minimum_kg_ha).toBeCloseTo(57, 1);
    expect(result.snapshot.fertilizer_sources).toHaveLength(3);
    expect(result.snapshot.lot_context.area_ha).toBe(10);
    expect(result.snapshot.lot_context.plants_per_ha).toBe(4000);
    expect(result.snapshot.optimization_config.coverageRanges.minPct).toBe(95);
  });

  it('retorna NO SOLUTION cuando ninguna fuente cubre un nutriente requerido', async () => {
    const engine = buildEngine();
    const result = await engine.calculate({
      ...BASE_INPUT,
      fertilizerSources: [{ name: 'Urea 46-0-0', composition: { N: 46 } }]
    });

    expect(result.status).toBe('no_solution');
    expect(result.uncovered_nutrients.sort()).toEqual(['K2O', 'P2O5']);
    expect(result.message).toMatch(/No existe una combinación factible/i);
    expect(result.products).toHaveLength(0);
    expect(result.total_cost).toBeNull();
  });

  it('respeta overrides de configuración de rangos y pesos', async () => {
    const engine = buildEngine();
    const result = await engine.calculate({
      ...BASE_INPUT,
      fertilizerSources: USER_SOURCES,
      formulationConfig: {
        coverageRanges: { minPct: 90, maxPct: 120 },
        objectiveWeights: { cost: 1, deviation: 0, dose: 0, excess: 0 }
      }
    });
    expect(result.snapshot.optimization_config.coverageRanges.minPct).toBe(90);
    expect(
      Object.values(result.nutrient_balance).every((b) => b.coverage >= 90 && b.coverage <= 120)
    ).toBe(true);
  });

  it('rechaza fuentes con composición inválida sin calcular (§27.2)', async () => {
    const engine = buildEngine();
    await expect(
      engine.calculate({
        ...BASE_INPUT,
        fertilizerSources: [{ name: 'Producto sin composición', composition: { N: 0, P2O5: null } }]
      })
    ).rejects.toThrow(CalcInvalidInputError);
  });
});

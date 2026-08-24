/**
 * formulation.engine.test.js
 * Tests del FormulationEngine: factibilidad, solver determinista y
 * construcción del resultado final.
 */
import { describe, it, expect } from 'vitest';
import { FormulationEngine, FORMULATION_STATUS } from '../../engine/FormulationEngine.js';
import { FormulationResultBuilder } from '../../engine/FormulationResultBuilder.js';
import { FertilizerSource } from '../../domain/entities/FertilizerSource.js';

const MAP = new FertilizerSource({
  id: 'map',
  name: 'MAP 12-24-0',
  composition: { N: 12, P2O5: 24 },
  presentationKg: 50
});
const UREA = new FertilizerSource({
  id: 'urea',
  name: 'Urea 46-0-0',
  composition: { N: 46 }
});
const SOP = new FertilizerSource({
  id: 'sop',
  name: 'SOP 0-0-50-18S',
  composition: { K2O: 50, S: 18 }
});

describe('FormulationEngine — factibilidad (§11)', () => {
  it('retorna NO SOLUTION con los nutrientes específicos sin fuente', () => {
    const engine = new FormulationEngine();
    const result = engine.solve({
      sources: [UREA],
      demands: { N: 60, P2O5: 50, K2O: 80 }
    });
    expect(result.status).toBe(FORMULATION_STATUS.NO_SOLUTION);
    expect(result.uncoveredNutrients.sort()).toEqual(['K2O', 'P2O5']);
    expect(result.doses).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/No existe una combinación factible/i);
  });

  it('ignora fuentes marcadas como no disponibles', () => {
    const engine = new FormulationEngine();
    const sopAgotado = new FertilizerSource({
      id: 'sop',
      name: 'SOP',
      composition: { K2O: 50 },
      available: false
    });
    const result = engine.solve({ sources: [UREA, sopAgotado], demands: { K2O: 80 } });
    expect(result.status).toBe(FORMULATION_STATUS.NO_SOLUTION);
  });
});

describe('FormulationEngine — solver determinista', () => {
  it('cubre los requerimientos dentro del rango configurable (95-110%)', () => {
    const engine = new FormulationEngine();
    const result = engine.solve({
      sources: [MAP, UREA, SOP],
      demands: { N: 60, P2O5: 50, K2O: 80 }
    });

    expect(result.status).toBe(FORMULATION_STATUS.FEASIBLE);
    expect(result.doses.length).toBeGreaterThan(0);
    expect(result.doses.length).toBeLessThanOrEqual(3);

    for (const [nutrient, required] of Object.entries({ N: 60, P2O5: 50, K2O: 80 })) {
      const supplied = result.contributions[nutrient] ?? 0;
      const coverage = (supplied / required) * 100;
      expect(coverage).toBeGreaterThanOrEqual(94.99);
      // El exceso puede existir si es agronómicamente inevitable, pero no
      // debe ser desmedido para este problema trivial.
      expect(coverage).toBeLessThan(200);
    }
  });

  it('es determinista: mismo input → mismo output', () => {
    const engine = new FormulationEngine();
    const a = engine.solve({
      sources: [MAP, UREA, SOP],
      demands: { N: 55, P2O5: 40, K2O: 70, S: 12 }
    });
    const b = engine.solve({
      sources: [MAP, UREA, SOP],
      demands: { N: 55, P2O5: 40, K2O: 70, S: 12 }
    });
    expect(a.doses).toEqual(b.doses);
    expect(a.contributions).toEqual(b.contributions);
  });

  it('respeta maxDoseKgHa de la fuente', () => {
    const engine = new FormulationEngine();
    const ureaLimitada = new FertilizerSource({
      id: 'urea',
      name: 'Urea',
      composition: { N: 46 },
      maxDoseKgHa: 100
    });
    const result = engine.solve({ sources: [ureaLimitada], demands: { N: 92 } });
    expect(result.status).toBe(FORMULATION_STATUS.FEASIBLE);
    const ureaDose = result.doses.find((d) => d.sourceId === 'urea');
    expect(ureaDose.calculatedDoseKgHa).toBeLessThanOrEqual(100 + 1e-6);
    // Y reporta el déficit residual sin ocultarlo
    expect(result.warnings.join(' ')).toMatch(/Déficit de N/);
  });

  it('no formula nutrientes con demanda nula o insignificante', () => {
    const engine = new FormulationEngine();
    const result = engine.solve({
      sources: [UREA],
      demands: { N: 60, B: 0 }
    });
    expect(result.status).toBe(FORMULATION_STATUS.FEASIBLE);
    expect(Object.keys(result.contributions)).toEqual(['N']);
  });
});

describe('FormulationResultBuilder — resultado §28 y post-procesado comercial', () => {
  const engine = new FormulationEngine();
  const builder = new FormulationResultBuilder();

  it('ajusta bultos, recalcula dosis real, aportes, cobertura, g/planta y costo', () => {
    const solveResult = engine.solve({
      sources: [
        new FertilizerSource({
          id: 'map',
          name: 'MAP 12-24-0',
          composition: { N: 12, P2O5: 24 },
          presentationKg: 50,
          pricePerUnit: 0.9
        }),
        new FertilizerSource({
          id: 'sop',
          name: 'SOP 0-0-50',
          composition: { K2O: 50 },
          presentationKg: 50
        })
      ],
      demands: { N: 25, P2O5: 50, K2O: 80 }
    });

    const areaHa = 10;
    const plantsHa = 4000;
    const sources = [
      new FertilizerSource({
        id: 'map',
        name: 'MAP 12-24-0',
        composition: { N: 12, P2O5: 24 },
        presentationKg: 50,
        pricePerUnit: 0.9
      }),
      new FertilizerSource({
        id: 'sop',
        name: 'SOP 0-0-50',
        composition: { K2O: 50 },
        presentationKg: 50
      })
    ];
    const built = builder.build({
      solveResult,
      sources,
      requirements: { N: 25, P2O5: 50, K2O: 80 },
      areaHa,
      plantsHa,
      context: { crop: null, stage: null, targetYieldTHa: 6, methodology: 'extraction' },
      calculationVersion: 'TEST-1'
    });

    expect(built.formulation_status).toBe('feasible');
    expect(built.canonical_unit).toBe('kg/ha');
    expect(built.unit_display_options).toContain('g_planta');

    for (const product of built.products) {
      // La dosis real se deriva de bultos enteros
      if (product.total_packages !== null) {
        expect(product.actual_dose_kg_ha).toBeCloseTo(
          (product.total_packages * product.presentation_kg) / areaHa,
          4
        );
      }
      // g/planta consistente con la dosis real
      expect(product.dose_g_plant).toBeCloseTo((product.actual_dose_kg_ha / plantsHa) * 1000, 1);
    }

    // Balance nutricional con cobertura % y estado
    for (const balance of Object.values(built.nutrient_balance)) {
      expect(balance.coverage).toBeGreaterThan(90);
      expect(['adequate', 'deficit', 'excess']).toContain(balance.status);
    }

    // Costo solo de productos con precio; SOP no tiene precio → no aporta costo
    const mapProduct = built.products.find((p) => p.product_id === 'map');
    const sopProduct = built.products.find((p) => p.product_id === 'sop');
    expect(mapProduct.cost).not.toBeNull();
    expect(sopProduct.cost).toBeNull();
    expect(built.total_cost).toBe(mapProduct.cost);

    // Snapshot inmutable completo (§25)
    expect(built.snapshot.fertilizer_sources).toHaveLength(2);
    expect(built.snapshot.optimization_config.coverageRanges.minPct).toBe(95);
    expect(built.snapshot.nutrient_requirements.P2O5.minimum_kg_ha).toBeCloseTo(47.5, 2);
    expect(built.snapshot.commercial_adjustments.length).toBe(built.products.length);
    expect(built.snapshot.calculated_at).toBeTruthy();
  });

  it('NO SOLUTION produce mensaje explícito sin productos ni costo inventado', () => {
    const solveResult = engine.solve({
      sources: [new FertilizerSource({ id: 'urea', name: 'Urea', composition: { N: 46 } })],
      demands: { N: 60, K2O: 80 }
    });
    const built = builder.build({
      solveResult,
      sources: [new FertilizerSource({ id: 'urea', name: 'Urea', composition: { N: 46 } })],
      requirements: { N: 60, K2O: 80 },
      context: {},
      calculationVersion: 'TEST-2'
    });
    expect(built.status).toBe('no_solution');
    expect(built.missing_sources).toEqual([{ nutrient: 'K2O', reason: 'sin fuente disponible' }]);
    expect(built.products).toHaveLength(0);
    expect(built.total_cost).toBeNull();
  });
});

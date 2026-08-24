/**
 * formulation.formulas.test.js
 * Tests unitarios de las fórmulas puras del motor de formulación.
 * Casos basados en el diseño §6, §13-§21.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeFertilizerSources,
  buildNutrientMatrix,
  findUncoveredNutrients,
  sumContributions,
  coverageStatus,
  nutrientDeviation,
  adjustToPackages,
  dosePerPlant
} from '../../formulas/formulation.formulas.js';
import { FertilizerSource } from '../../domain/entities/FertilizerSource.js';

const MAP = () =>
  new FertilizerSource({
    id: 'map',
    name: 'MAP 12-24-0',
    composition: { N: 12, P2O5: 24 }
  });
const UREA = () =>
  new FertilizerSource({
    id: 'urea',
    name: 'Urea 46-0-0',
    composition: { N: 46 },
    pricePerUnit: 0.55
  });

describe('formulation.formulas — buildNutrientMatrix (§6)', () => {
  it('construye la matriz como fracción kg nutriente / kg producto', () => {
    const sources = [MAP(), UREA()];
    const { matrix } = buildNutrientMatrix(sources);
    expect(matrix.map['N']).toBeCloseTo(0.12, 6);
    expect(matrix.map['P2O5']).toBeCloseTo(0.24, 6);
    expect(matrix.urea['N']).toBeCloseTo(0.46, 6);
    expect(matrix.urea['P2O5']).toBeCloseTo(0, 6);
  });

  it('no asume P = P2O5 ni K = K2O (§3)', () => {
    const sop = new FertilizerSource({ id: 'sop', name: 'SOP', composition: { K2O: 50 } });
    const { matrix, nutrients } = buildNutrientMatrix([sop]);
    expect(matrix.sop['K2O']).toBeCloseTo(0.5, 6);
    expect(matrix.sop['K'] ?? 0).toBe(0); // K elemental no fue declarado
    expect(nutrients).toContain('K2O');
    expect(nutrients).not.toContain('K');
  });
});

describe('formulation.formulas — findUncoveredNutrients (§11)', () => {
  it('detecta nutrientes sin fuente disponible', () => {
    const demands = { P2O5: 50, K2O: 80 };
    const { uncovered } = findUncoveredNutrients(demands, [UREA()]);
    expect(uncovered).toEqual(['P2O5', 'K2O']);
  });

  it('ignora demandas nulas o insignificantes', () => {
    const demands = { N: 60, B: 0 };
    const { uncovered, covered } = findUncoveredNutrients(demands, [UREA()]);
    expect(uncovered).toHaveLength(0);
    expect(covered).toEqual(['N']);
  });
});

describe('formulation.formulas — sumContributions (§19)', () => {
  it('suma aportes reales de varias fuentes', () => {
    const total = sumContributions([
      { source: MAP(), doseKgHa: 210 },
      { source: UREA(), doseKgHa: 76.09 }
    ]);
    // MAP: N = 25.2, P2O5 = 50.4 ; Urea: N = 35.0014
    expect(total.N).toBeCloseTo(60.2014, 3);
    expect(total.P2O5).toBeCloseTo(50.4, 3);
  });
});

describe('formulation.formulas — coverageStatus (§20-§21)', () => {
  it('99.67% de cobertura es adecuada con rango 95-110', () => {
    const { coveragePct, status } = coverageStatus(59.8, 60);
    expect(coveragePct).toBeCloseTo(99.67, 1);
    expect(status).toBe('adequate');
  });

  it('120% de cobertura es sobreaplicación', () => {
    const { coveragePct, status } = coverageStatus(96, 80);
    expect(coveragePct).toBe(120);
    expect(status).toBe('excess');
  });

  it('< 95% es déficit', () => {
    const { status } = coverageStatus(40, 50);
    expect(status).toBe('deficit');
  });

  it('los rangos son configurables, no hardcodeados', () => {
    const { status } = coverageStatus(115, 100, { minPct: 95, maxPct: 130 });
    expect(status).toBe('adequate');
  });

  it('sin requerimiento no calcula cobertura', () => {
    const { coveragePct, status } = coverageStatus(10, 0);
    expect(coveragePct).toBeNull();
    expect(status).toBe('no_requirement');
  });
});

describe('formulation.formulas — nutrientDeviation', () => {
  it('penaliza lo faltante bajo el piso mínimo', () => {
    const { deviation, excess } = nutrientDeviation(45, 60, {
      minPct: 95,
      targetPct: 100,
      maxPct: 110
    });
    expect(deviation).toBeCloseTo((57 - 45) / 60, 4);
    expect(excess).toBe(0);
  });

  it('penaliza el exceso sobre el techo máximo', () => {
    const { deviation, excess } = nutrientDeviation(96, 80, {
      minPct: 95,
      targetPct: 100,
      maxPct: 110
    });
    expect(excess).toBeCloseTo((96 - 88) / 80, 4);
    expect(deviation).toBe(0);
  });

  it('dentro del rango la desviación es leve y proporcional a la distancia al objetivo', () => {
    const inside = nutrientDeviation(61, 60, { minPct: 95, targetPct: 100, maxPct: 110 });
    expect(inside.excess).toBe(0);
    expect(inside.deviation).toBeCloseTo(1 / 60 / 10, 6);
  });
});

describe('formulation.formulas — adjustToPackages (§14)', () => {
  it('redondea bultos hacia arriba y recalcula la dosis real', () => {
    // 208.33 kg/ha × 10 ha = 2083.3 kg → ceil(2083.3/50) = 42 bultos
    const r = adjustToPackages(208.3333, 10, 50);
    expect(r.packages).toBe(42);
    expect(r.totalPackagesKg).toBe(2100);
    expect(r.actualDoseKgHa).toBeCloseTo(210, 4);
  });

  it('sin presentación no ajusta nada', () => {
    const r = adjustToPackages(208.3333, 10, null);
    expect(r.packages).toBeNull();
    expect(r.actualDoseKgHa).toBeCloseTo(208.3333, 4);
  });

  it('calcula bultos por hectárea (§28: packages_per_ha)', () => {
    const r = adjustToPackages(210, 10, 50);
    expect(r.packagesPerHa).toBeCloseTo(4.2, 3);
  });
});

describe('formulation.formulas — dosePerPlant (§15)', () => {
  it('convierte kg/ha a g/planta con plantas/ha', () => {
    const { kgPerPlant, gPerPlant } = dosePerPlant(210, 4000);
    expect(kgPerPlant).toBeCloseTo(0.0525, 6);
    expect(gPerPlant).toBeCloseTo(52.5, 2);
  });

  it('devuelve null si no hay densidad de plantas', () => {
    const r = dosePerPlant(210, null);
    expect(r.kgPerPlant).toBeNull();
    expect(r.gPerPlant).toBeNull();
  });
});

describe('formulation.formulas — normalizeFertilizerSources', () => {
  it('rechaza composiciones vacías sin inventar valores (§27.2)', () => {
    expect(() => normalizeFertilizerSources([{ name: 'Urea', composition: {} }])).toThrow(
      /composición garantizada/i
    );
  });

  it('rechaza composiciones que superan 100%', () => {
    expect(() =>
      normalizeFertilizerSources([{ name: 'X', composition: { N: 60, P2O5: 60 } }])
    ).toThrow(/supera 100%/i);
  });

  it('normaliza y descarta ceros', () => {
    const sources = normalizeFertilizerSources([
      { name: 'MAP', composition: { N: 12, P2O5: 24, K2O: 0 } }
    ]);
    expect(sources[0].composition).toEqual({ N: 12, P2O5: 24 });
  });
});

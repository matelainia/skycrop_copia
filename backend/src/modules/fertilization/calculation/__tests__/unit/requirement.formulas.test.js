/**
 * requirement.formulas.test.js
 * Tests unitarios de las fórmulas de requerimientos nutricionales.
 */
import { describe, it, expect } from 'vitest';
import {
  scaleRequirementToYield,
  calculateByExtraction,
  aggregateStageRequirements,
  applyStagePercentage,
  applyGlobalFactor,
  calculateAllRequirements,
  applyCorrectionFactors
} from '../../formulas/requirement.formulas.js';

describe('requirement.formulas — scaleRequirementToYield', () => {
  it('escala linealmente al rendimiento objetivo', () => {
    // Cacao: 80 kg N/ha para 1 t/ha → 240 kg N/ha para 3 t/ha
    const result = scaleRequirementToYield(80, 3.0, 1.0);
    expect(result).toBeCloseTo(240, 4);
  });

  it('no escala si referenceYield es 0', () => {
    const result = scaleRequirementToYield(80, 3.0, 0);
    expect(result).toBe(80);
  });

  it('escala a la baja correctamente', () => {
    // 120 kg/ha a 0.5 t/ha con referencia 2 t/ha → 30 kg/ha
    const result = scaleRequirementToYield(120, 0.5, 2.0);
    expect(result).toBeCloseTo(30, 4);
  });
});

describe('requirement.formulas — calculateByExtraction', () => {
  it('calcula correctamente por coeficiente de extracción', () => {
    // Si extraemos 80 kg N por tonelada y producimos 2.5 t/ha
    const result = calculateByExtraction(80, 2.5);
    expect(result).toBeCloseTo(200, 4);
  });

  it('devuelve 0 para rendimiento negativo o cero', () => {
    expect(calculateByExtraction(80, 0)).toBe(0);
    expect(calculateByExtraction(80, -1)).toBe(0);
  });
});

describe('requirement.formulas — aggregateStageRequirements', () => {
  it('suma los requerimientos de varias etapas por nutriente', () => {
    const stage1 = new Map([
      ['N', 30],
      ['P2O5', 10]
    ]);
    const stage2 = new Map([
      ['N', 50],
      ['K2O', 80]
    ]);
    const stage3 = new Map([
      ['N', 20],
      ['P2O5', 15]
    ]);

    const total = aggregateStageRequirements([stage1, stage2, stage3]);

    expect(total.get('N')).toBeCloseTo(100, 4);
    expect(total.get('P2O5')).toBeCloseTo(25, 4);
    expect(total.get('K2O')).toBeCloseTo(80, 4);
  });

  it('maneja array vacío', () => {
    const total = aggregateStageRequirements([]);
    expect(total.size).toBe(0);
  });
});

describe('requirement.formulas — applyStagePercentage', () => {
  it('aplica porcentaje correctamente', () => {
    expect(applyStagePercentage(100, 30)).toBeCloseTo(30, 4);
    expect(applyStagePercentage(80, 50)).toBeCloseTo(40, 4);
  });

  it('lanza error si porcentaje fuera de rango', () => {
    expect(() => applyStagePercentage(100, 110)).toThrow();
    expect(() => applyStagePercentage(100, -5)).toThrow();
  });
});

describe('requirement.formulas — calculateAllRequirements', () => {
  const mockRequirements = [
    { nutrientCode: 'N', amountKgHa: 80, referenceYield: 1.0, methodology: 'extraction' },
    { nutrientCode: 'P2O5', amountKgHa: 30, referenceYield: 1.0, methodology: 'extraction' },
    { nutrientCode: 'K2O', amountKgHa: 120, referenceYield: 1.0, methodology: 'extraction' }
  ];

  it('calcula y escala al rendimiento objetivo', () => {
    const result = calculateAllRequirements(mockRequirements, 2.0, null);
    expect(result['N']).toBeCloseTo(160, 4);
    expect(result['P2O5']).toBeCloseTo(60, 4);
    expect(result['K2O']).toBeCloseTo(240, 4);
  });

  it('filtra por metodología', () => {
    const reqs = [
      ...mockRequirements,
      { nutrientCode: 'Ca', amountKgHa: 50, referenceYield: null, methodology: 'balance' }
    ];
    const result = calculateAllRequirements(reqs, 1.0, 'extraction');
    expect(result['N']).toBeDefined();
    expect(result['Ca']).toBeUndefined();
  });
});

describe('requirement.formulas — applyCorrectionFactors', () => {
  it('aplica factor específico por nutriente', () => {
    const reqs = { N: 80, P2O5: 30, K2O: 120 };
    const factors = { P2O5: 1.3 };
    const result = applyCorrectionFactors(reqs, factors);
    expect(result['N']).toBe(80);
    expect(result['P2O5']).toBeCloseTo(39, 4);
    expect(result['K2O']).toBe(120);
  });

  it('aplica factor global _all', () => {
    const reqs = { N: 100, K2O: 200 };
    const factors = { _all: 1.1 };
    const result = applyCorrectionFactors(reqs, factors);
    expect(result['N']).toBeCloseTo(110, 4);
    expect(result['K2O']).toBeCloseTo(220, 4);
  });

  it('factor específico tiene prioridad sobre _all', () => {
    const reqs = { N: 100, K2O: 200 };
    const factors = { _all: 1.1, K2O: 1.5 };
    const result = applyCorrectionFactors(reqs, factors);
    expect(result['N']).toBeCloseTo(110, 4);
    expect(result['K2O']).toBeCloseTo(300, 4);
  });
});

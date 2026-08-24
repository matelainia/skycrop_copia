/**
 * fertilizer.formulas.test.js
 * Tests unitarios de las fórmulas de fertilizantes.
 */
import { describe, it, expect } from 'vitest';
import {
  nutrientToProduct,
  productToNutrient,
  productNutrientYield,
  calculateDoseForNutrient,
  validateAndCapDose,
  evaluateFertilizerCoverage,
  calculateRemainingAfterDose,
  sumNutrientContributions
} from '../../formulas/fertilizer.formulas.js';

describe('fertilizer.formulas — nutrientToProduct', () => {
  it('convierte kg de nutriente a kg de producto: Urea (N=46%)', () => {
    // 80 kg N / 0.46 = 173.9 kg Urea
    expect(nutrientToProduct(80, 46)).toBeCloseTo(173.91, 1);
  });

  it('devuelve Infinity si el fertilizante no contiene el nutriente', () => {
    expect(nutrientToProduct(80, 0)).toBe(Infinity);
  });
});

describe('fertilizer.formulas — productToNutrient', () => {
  it('convierte kg de producto a kg de nutriente: DAP (P2O5=46%)', () => {
    // 200 kg DAP * 0.46 = 92 kg P2O5
    expect(productToNutrient(200, 46)).toBeCloseTo(92, 4);
  });

  it('devuelve 0 si el porcentaje es 0', () => {
    expect(productToNutrient(200, 0)).toBe(0);
  });
});

describe('fertilizer.formulas — productNutrientYield', () => {
  it('calcula aportes de NPK 15-15-15', () => {
    const composition = { N: 15, P2O5: 15, K2O: 15 };
    const result = productNutrientYield(200, composition);
    expect(result['N']).toBeCloseTo(30, 4);
    expect(result['P2O5']).toBeCloseTo(30, 4);
    expect(result['K2O']).toBeCloseTo(30, 4);
  });

  it('calcula aportes de Urea (N=46%)', () => {
    const result = productNutrientYield(150, { N: 46 });
    expect(result['N']).toBeCloseTo(69, 4);
  });
});

describe('fertilizer.formulas — calculateDoseForNutrient', () => {
  it('calcula dosis de Urea para cubrir N y sus subproductos', () => {
    // Necesito 80 kg N. Urea tiene 46% N
    const { doseKgHa, byproducts } = calculateDoseForNutrient('N', 80, { N: 46 });
    expect(doseKgHa).toBeCloseTo(173.91, 1);
    expect(Object.keys(byproducts)).toHaveLength(0); // Urea no aporta otros
  });

  it('calcula subproductos de DAP para cubrir P2O5', () => {
    // Necesito 30 kg P2O5. DAP tiene 18% N + 46% P2O5
    const { doseKgHa, byproducts } = calculateDoseForNutrient('P2O5', 30, { N: 18, P2O5: 46 });
    expect(doseKgHa).toBeCloseTo(65.22, 1);
    expect(byproducts['N']).toBeGreaterThan(0); // DAP también aporta N
  });

  it('devuelve Infinity si el fertilizante no tiene el nutriente', () => {
    const { doseKgHa } = calculateDoseForNutrient('N', 80, { P2O5: 46 });
    expect(doseKgHa).toBe(Infinity);
  });
});

describe('fertilizer.formulas — validateAndCapDose', () => {
  it('valida dosis dentro del rango', () => {
    const { valid, capped, reason } = validateAndCapDose(200, 100, 500);
    expect(valid).toBe(true);
    expect(capped).toBe(200);
    expect(reason).toBeNull();
  });

  it('limita al máximo cuando se excede', () => {
    const { valid, capped } = validateAndCapDose(600, 100, 500);
    expect(valid).toBe(false);
    expect(capped).toBe(500);
  });

  it('aplica mínimo cuando la dosis es muy baja', () => {
    const { valid, capped } = validateAndCapDose(50, 100, 500);
    expect(valid).toBe(false);
    expect(capped).toBe(100);
  });

  it('permite dosis 0 sin aplicar mínimo', () => {
    // Dosis 0 significa que no se aplica el producto
    const { valid, capped } = validateAndCapDose(0, 50, 500);
    expect(capped).toBe(0);
  });
});

describe('fertilizer.formulas — evaluateFertilizerCoverage', () => {
  const mockFertilizer = {
    composition: { N: 18, P2O5: 46 }
  };

  it('da coverageScore mayor para fertilizantes que cubren más demanda', () => {
    const demands = { N: 80, P2O5: 30 };
    const { coverageScore, nutrientsCovered } = evaluateFertilizerCoverage(mockFertilizer, demands);
    expect(coverageScore).toBeGreaterThan(0);
    expect(nutrientsCovered).toContain('N');
    expect(nutrientsCovered).toContain('P2O5');
  });

  it('devuelve coverageScore 0 si no cubre ningún nutriente demandado', () => {
    const demands = { K2O: 120 };
    const { coverageScore } = evaluateFertilizerCoverage(mockFertilizer, demands);
    expect(coverageScore).toBe(0);
  });
});

describe('fertilizer.formulas — calculateRemainingAfterDose', () => {
  it('reduce las demandas remanentes al aplicar un fertilizante', () => {
    const demands = { N: 80, P2O5: 30 };
    const { remainingDemand } = calculateRemainingAfterDose(demands, {}, 100, { N: 18, P2O5: 46 });
    // 100 kg DAP aporta: 18 kg N, 46 kg P2O5
    expect(remainingDemand['N']).toBeCloseTo(62, 1);
    expect(remainingDemand['P2O5']).toBe(0); // Cubierto (46 > 30)
  });

  it('no genera demandas negativas', () => {
    const demands = { N: 10 };
    const { remainingDemand } = calculateRemainingAfterDose(demands, {}, 200, { N: 46 });
    expect(remainingDemand['N']).toBe(0);
  });
});

describe('fertilizer.formulas — sumNutrientContributions', () => {
  it('suma las contribuciones de múltiples fertilizantes', () => {
    const doses = [
      { doseKgHa: 100, composition: { N: 46 } }, // 46 kg N
      { doseKgHa: 150, composition: { N: 18, P2O5: 46 } }, // 27 N + 69 P2O5
      { doseKgHa: 100, composition: { K2O: 60 } } // 60 K2O
    ];
    const total = sumNutrientContributions(doses);
    expect(total['N']).toBeCloseTo(73, 4);
    expect(total['P2O5']).toBeCloseTo(69, 4);
    expect(total['K2O']).toBeCloseTo(60, 4);
  });

  it('maneja array vacío', () => {
    const total = sumNutrientContributions([]);
    expect(Object.keys(total)).toHaveLength(0);
  });
});

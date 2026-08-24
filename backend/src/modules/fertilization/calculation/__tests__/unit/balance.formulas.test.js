/**
 * balance.formulas.test.js
 * Tests unitarios de las fórmulas de balance nutricional.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateNetDemand,
  applySoilCorrectionFactor,
  calculateBalance,
  calculateFullBalance,
  buildFullBalance
} from '../../formulas/balance.formulas.js';

describe('balance.formulas — calculateNetDemand', () => {
  it('calcula demanda neta correctamente', () => {
    expect(calculateNetDemand(80, 20)).toBe(60);
    expect(calculateNetDemand(80, 0)).toBe(80);
    expect(calculateNetDemand(30, 30)).toBe(0);
  });

  it('devuelve 0 cuando el suelo aporta más de lo requerido', () => {
    expect(calculateNetDemand(30, 50)).toBe(0); // No se puede aplicar negativo
  });
});

describe('balance.formulas — applySoilCorrectionFactor', () => {
  it('aumenta la demanda con factor > 1 (suelo deficiente)', () => {
    // Factor 1.3 = suelo bajo en P → necesito 30% más
    expect(applySoilCorrectionFactor(60, 1.3)).toBeCloseTo(78, 4);
  });

  it('reduce la demanda con factor < 1 (suelo alto)', () => {
    // Factor 0.7 = suelo alto en K → reducir 30%
    expect(applySoilCorrectionFactor(120, 0.7)).toBeCloseTo(84, 4);
  });

  it('sin cambio con factor 1.0', () => {
    expect(applySoilCorrectionFactor(80, 1.0)).toBeCloseTo(80, 4);
  });

  it('devuelve 0 si factor es 0', () => {
    expect(applySoilCorrectionFactor(80, 0)).toBe(0);
  });
});

describe('balance.formulas — calculateBalance', () => {
  it('balance positivo = exceso', () => {
    expect(calculateBalance(100, 80)).toBeCloseTo(20, 4);
  });

  it('balance negativo = déficit', () => {
    expect(calculateBalance(60, 80)).toBeCloseTo(-20, 4);
  });

  it('balance 0 = exactamente cubierto', () => {
    expect(calculateBalance(80, 80)).toBe(0);
  });
});

describe('balance.formulas — calculateFullBalance', () => {
  it('calcula todos los pasos del balance correctamente', () => {
    const result = calculateFullBalance({
      requirementKgHa: 80,
      soilContributionKgHa: 20,
      correctionFactor: 1.3,
      efficiency: 0.65,
      appliedKgHa: 0
    });

    // netDemand = 80 - 20 = 60
    expect(result.netDemand).toBeCloseTo(60, 4);
    // correctedDemand = 60 * 1.3 = 78
    expect(result.correctedDemand).toBeCloseTo(78, 4);
    // effectiveDemand = 78 / 0.65 = 120
    expect(result.effectiveDemand).toBeCloseTo(120, 2);
    // balance = 0 - 120 = -120 (déficit)
    expect(result.balance).toBeCloseTo(-120, 2);
  });
});

describe('balance.formulas — buildFullBalance', () => {
  it('genera array de balances con status correcto', () => {
    const balanceDetail = {
      N: { requirement: 80, soilContribution: 20, netDemand: 60 },
      P2O5: { requirement: 30, soilContribution: 5, netDemand: 25 },
      K2O: { requirement: 120, soilContribution: 40, netDemand: 80 }
    };
    const efficiencies = { N: 0.65, P2O5: 0.25, K2O: 0.7 };
    const totalApplied = {
      N: 120, // effectiveDemand = 60/0.65 ≈ 92 → cubierto (120 > 92)
      P2O5: 110, // effectiveDemand = 25/0.25 = 100 → exceso (110 > 100)
      K2O: 50 // effectiveDemand = 80/0.70 ≈ 114 → déficit (50 < 114)
    };

    const result = buildFullBalance(balanceDetail, efficiencies, totalApplied);

    expect(result).toHaveLength(3);

    const N = result.find((r) => r.nutrientCode === 'N');
    expect(N).toBeDefined();
    expect(N.requirement).toBe(80);
    expect(N.netDemand).toBe(60);
    expect(['covered', 'deficit', 'surplus']).toContain(N.status);

    const K2O = result.find((r) => r.nutrientCode === 'K2O');
    expect(K2O.status).toBe('deficit');

    const P2O5 = result.find((r) => r.nutrientCode === 'P2O5');
    expect(P2O5.status).toBe('surplus');
  });
});

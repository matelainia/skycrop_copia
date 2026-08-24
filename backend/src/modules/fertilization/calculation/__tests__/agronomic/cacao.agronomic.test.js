/**
 * cacao.agronomic.test.js
 * Tests de escenario agronómico completo — Cacao
 *
 * Simula un cálculo real para cacao con:
 *   - Rendimiento objetivo: 2 t/ha
 *   - Suelo ácido (pH 5.2) con bajo P y K medio
 *   - Fertilizantes: Urea, DAP, KCl
 *
 * Verifica que el resultado sea agronómicamente coherente.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock de AppErrors para evitar dependencia del shared/ module en tests
vi.mock('../../../../../shared/errors/AppErrors.js', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode, code) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
    }
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message) {
      super(message);
    }
  }
}));

import {
  calculateAllRequirements,
  applyCorrectionFactors
} from '../../formulas/requirement.formulas.js';
import { calculateNetDemand } from '../../formulas/balance.formulas.js';
import { buildEfficiencyMap, applyEfficiencies } from '../../formulas/efficiency.formulas.js';
import {
  calculateDoseForNutrient,
  productNutrientYield,
  sumNutrientContributions
} from '../../formulas/fertilizer.formulas.js';
import { Fertilizer } from '../../domain/entities/Fertilizer.js';
import { SoilAnalysis } from '../../domain/entities/SoilAnalysis.js';
import { classifyNutrientLevel } from '../../formulas/soil.formulas.js';

// ─── Datos del escenario ──────────────────────────────────────────────────────

const CACAO_REQUIREMENTS = [
  { nutrientCode: 'N', amountKgHa: 80, referenceYield: 1.0, methodology: 'extraction' },
  { nutrientCode: 'P2O5', amountKgHa: 30, referenceYield: 1.0, methodology: 'extraction' },
  { nutrientCode: 'K2O', amountKgHa: 120, referenceYield: 1.0, methodology: 'extraction' },
  { nutrientCode: 'Ca', amountKgHa: 40, referenceYield: 1.0, methodology: 'extraction' },
  { nutrientCode: 'Mg', amountKgHa: 20, referenceYield: 1.0, methodology: 'extraction' }
];

const SOIL = new SoilAnalysis({
  id: 'soil-test-1',
  ph: 5.2,
  organicMatter: 1.5, // Bajo
  cec: 12,
  texture: 'clay',
  nutrients: {
    P: { value: 6, unit: 'mg/kg' }, // Bajo
    K: { value: 0.25, unit: 'cmol/kg' }, // Medio
    Ca: { value: 4, unit: 'cmol/kg' }, // Bajo
    Mg: { value: 1.2, unit: 'cmol/kg' } // Medio
  }
});

const FERTILIZERS = {
  urea: new Fertilizer({ id: 'f1', commercialName: 'Urea (46-0-0)', composition: { N: 46 } }),
  dap: new Fertilizer({
    id: 'f2',
    commercialName: 'DAP (18-46-0)',
    composition: { N: 18, P2O5: 46 }
  }),
  kcl: new Fertilizer({ id: 'f3', commercialName: 'KCl (0-0-60)', composition: { K2O: 60 } }),
  cal: new Fertilizer({
    id: 'f4',
    commercialName: 'Cal Dolomítica',
    composition: { Ca: 20, Mg: 10 }
  })
};

// ─── Tests del escenario ──────────────────────────────────────────────────────

describe('Escenario Agronómico: Cacao 2 t/ha - Suelo Ácido', () => {
  const TARGET_YIELD = 2.0;

  let baseRequirements;
  let netDemands;
  let effectiveDemands;

  beforeEach(() => {
    // 1. Calcular requerimientos base
    baseRequirements = calculateAllRequirements(CACAO_REQUIREMENTS, TARGET_YIELD, null);

    // 2. Aplicar corrección por suelo ácido (P2O5 +30% en pH < 5.5)
    const correctionFactors = { P2O5: 1.3 };
    const correctedRequirements = applyCorrectionFactors(baseRequirements, correctionFactors);

    // 3. Estimar aporte del suelo (simplificado para test)
    const soilContributions = {
      N: SOIL.organicMatter * 20 * 0.04, // MO% → N disponible
      P2O5: 0, // Suelo bajo en P
      K2O: 3, // Algo de K disponible
      Ca: 5, // Bajo
      Mg: 2
    };

    // 4. Calcular demandas netas
    netDemands = {};
    for (const [nutrient, req] of Object.entries(correctedRequirements)) {
      netDemands[nutrient] = calculateNetDemand(req, soilContributions[nutrient] ?? 0);
    }

    // 5. Aplicar eficiencias (suelo arcilloso, pH ácido)
    const efficiencies = buildEfficiencyMap(Object.keys(netDemands), {}, 'granular');
    effectiveDemands = applyEfficiencies(netDemands, efficiencies);
  });

  it('los requerimientos escalan correctamente a 2 t/ha', () => {
    expect(baseRequirements['N']).toBeCloseTo(160, 2); // 80 * 2
    expect(baseRequirements['P2O5']).toBeCloseTo(60, 2); // 30 * 2
    expect(baseRequirements['K2O']).toBeCloseTo(240, 2); // 120 * 2
  });

  it('la corrección de suelo ácido aumenta el requerimiento de P2O5', () => {
    const corrected = applyCorrectionFactors(baseRequirements, { P2O5: 1.3 });
    expect(corrected['P2O5']).toBeGreaterThan(baseRequirements['P2O5']);
    expect(corrected['P2O5']).toBeCloseTo(78, 1); // 60 * 1.3
  });

  it('las demandas netas son positivas y razonables para cacao', () => {
    for (const [nutrient, demand] of Object.entries(netDemands)) {
      expect(demand).toBeGreaterThanOrEqual(0);
    }
    // N debe ser el mayor requerimiento
    expect(netDemands['N']).toBeGreaterThan(netDemands['P2O5']);
    expect(netDemands['K2O']).toBeGreaterThan(netDemands['N']);
  });

  it('la clasificación de suelo detecta bajo fósforo correctamente', () => {
    const classification = classifyNutrientLevel('P', 6); // 6 mg/kg = LOW
    expect(classification.classification).toBe('low');
    expect(classification.correctionFactor).toBeGreaterThan(1.0);
  });

  it('el suelo ácido del escenario es correctamente identificado', () => {
    expect(SOIL.isAcidic).toBe(true);
    expect(SOIL.ph).toBe(5.2);
  });

  it('las dosis de fertilizantes cubren la demanda de N con Urea', () => {
    const nDemand = effectiveDemands['N'] ?? 0;
    if (nDemand <= 0) return;

    const { doseKgHa } = calculateDoseForNutrient('N', nDemand, FERTILIZERS.urea.composition);

    expect(Number.isFinite(doseKgHa)).toBe(true);
    expect(doseKgHa).toBeGreaterThan(0);

    // Verificar que la dosis realmente cubre la demanda
    const applied = productNutrientYield(doseKgHa, FERTILIZERS.urea.composition);
    expect(applied['N']).toBeGreaterThanOrEqual(nDemand * 0.99); // ≥ 99% de lo demandado
  });

  it('DAP cubre P2O5 y aporta N simultáneamente', () => {
    const p2o5Demand = effectiveDemands['P2O5'] ?? 60;
    const { doseKgHa, byproducts } = calculateDoseForNutrient(
      'P2O5',
      p2o5Demand,
      FERTILIZERS.dap.composition
    );

    expect(Number.isFinite(doseKgHa)).toBe(true);
    expect(byproducts['N']).toBeGreaterThan(0); // DAP aporta N como subproducto
  });

  it('la suma de contribuciones de múltiples fertilizantes es correcta', () => {
    const doses = [
      { doseKgHa: 200, composition: { N: 46 } }, // Urea
      { doseKgHa: 150, composition: { N: 18, P2O5: 46 } }, // DAP
      { doseKgHa: 300, composition: { K2O: 60 } } // KCl
    ];

    const total = sumNutrientContributions(doses);

    // 200*0.46 + 150*0.18 = 92 + 27 = 119 kg N
    expect(total['N']).toBeCloseTo(119, 4);
    // 150*0.46 = 69 kg P2O5
    expect(total['P2O5']).toBeCloseTo(69, 4);
    // 300*0.60 = 180 kg K2O
    expect(total['K2O']).toBeCloseTo(180, 4);
  });

  it('el plan resultante no tiene valores NaN o negativos en demandas efectivas', () => {
    for (const [nutrient, demand] of Object.entries(effectiveDemands)) {
      expect(demand).not.toBeNaN();
      expect(demand).toBeGreaterThanOrEqual(0);
    }
  });
});

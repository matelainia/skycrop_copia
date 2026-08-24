/**
 * entities.test.js
 * Tests unitarios de las entidades del dominio del motor de cálculo.
 * Solo prueba la lógica pura de las entidades — sin dependencias externas.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock de AppErrors para tests sin necesitar el shared/ module
vi.mock('../../../../shared/errors/AppErrors.js', () => ({
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
      this.statusCode = 404;
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.statusCode = 400;
    }
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message) {
      super(message);
      this.statusCode = 500;
    }
  }
}));

// Importar después del mock
const { Crop } = await import('../../domain/entities/Crop.js');
const { PhenologicalStage } = await import('../../domain/entities/PhenologicalStage.js');
const { Nutrient } = await import('../../domain/entities/Nutrient.js');
const { Fertilizer } = await import('../../domain/entities/Fertilizer.js');
const { SoilAnalysis } = await import('../../domain/entities/SoilAnalysis.js');
const { CropRequirement } = await import('../../domain/entities/CropRequirement.js');
const { FertilizationResult } = await import('../../domain/entities/FertilizationResult.js');
const { InvalidFertilizerError, InvalidSoilAnalysisError } =
  await import('../../domain/errors/FertilizationErrors.js');

// ─── Crop ─────────────────────────────────────────────────────────────────────
describe('Crop', () => {
  it('crea un cultivo válido', () => {
    const crop = new Crop({ id: 'uuid-1', name: 'Cacao' });
    expect(crop.name).toBe('Cacao');
    expect(crop.isActive).toBe(true);
  });

  it('lanza error si falta id o name', () => {
    expect(() => new Crop({ id: '', name: 'Cacao' })).toThrow();
    expect(() => new Crop({ id: 'uuid-1', name: '' })).toThrow();
  });

  it('serializa correctamente con toObject()', () => {
    const crop = new Crop({ id: 'uuid-1', name: 'Maíz', scientificName: 'Zea mays' });
    const obj = crop.toObject();
    expect(obj.name).toBe('Maíz');
    expect(obj.scientificName).toBe('Zea mays');
  });

  it('crea desde fila de Supabase con fromRow()', () => {
    const row = { id: 'uuid-1', name: 'Café', scientific_name: 'Coffea arabica', status: 'active' };
    const crop = Crop.fromRow(row);
    expect(crop.name).toBe('Café');
    expect(crop.scientificName).toBe('Coffea arabica');
  });
});

// ─── PhenologicalStage ────────────────────────────────────────────────────────
describe('PhenologicalStage', () => {
  it('crea una etapa válida', () => {
    const stage = new PhenologicalStage({
      id: 'uuid-s1',
      cropId: 'uuid-c1',
      name: 'Floración',
      order: 3
    });
    expect(stage.name).toBe('Floración');
    expect(stage.order).toBe(3);
    expect(stage.isActive).toBe(true);
  });

  it('lanza error si order < 1', () => {
    expect(
      () =>
        new PhenologicalStage({
          id: 'uuid-s1',
          cropId: 'uuid-c1',
          name: 'Test',
          order: 0
        })
    ).toThrow();
  });

  it('crea desde fila de Supabase con fromRow()', () => {
    const row = {
      id: 'uuid-s1',
      crop_id: 'uuid-c1',
      name: 'Llenado',
      stage_order: 4,
      duration_days: 90,
      status: 'active'
    };
    const stage = PhenologicalStage.fromRow(row);
    expect(stage.order).toBe(4);
    expect(stage.durationDays).toBe(90);
  });
});

// ─── Nutrient ─────────────────────────────────────────────────────────────────
describe('Nutrient', () => {
  it('catálogo por defecto contiene los macronutrientes principales', () => {
    const catalog = Nutrient.getDefaultCatalog();
    expect(catalog.has('N')).toBe(true);
    expect(catalog.has('P2O5')).toBe(true);
    expect(catalog.has('K2O')).toBe(true);
    expect(catalog.has('Ca')).toBe(true);
    expect(catalog.has('Mg')).toBe(true);
  });

  it('findByCode lanza error para código desconocido', () => {
    expect(() => Nutrient.findByCode('XX')).toThrow();
  });

  it('convierte entre formas químicas correctamente', () => {
    const P = Nutrient.findByCode('P');
    // P elemental → P2O5: factor ≈ 2.2914
    const p2o5 = P.convertTo(10, 'P2O5');
    expect(p2o5).toBeGreaterThan(20);
  });
});

// ─── Fertilizer ───────────────────────────────────────────────────────────────
describe('Fertilizer', () => {
  it('crea un fertilizante simple válido (Urea)', () => {
    const urea = new Fertilizer({
      id: 'uuid-f1',
      commercialName: 'Urea (46-0-0)',
      composition: { N: 46 }
    });
    expect(urea.commercialName).toBe('Urea (46-0-0)');
    expect(urea.composition).toEqual({ N: 46 });
  });

  it('lanza error si composición está vacía', () => {
    expect(
      () =>
        new Fertilizer({
          id: 'uuid-f1',
          commercialName: 'Vacío',
          composition: {}
        })
    ).toThrow(InvalidFertilizerError);
  });

  it('lanza error si suma de composición > 100%', () => {
    expect(
      () =>
        new Fertilizer({
          id: 'uuid-f1',
          commercialName: 'Invalido',
          composition: { N: 60, P2O5: 50 }
        })
    ).toThrow(InvalidFertilizerError);
  });

  it('calcula contribución de nutriente correctamente', () => {
    const dap = new Fertilizer({
      id: 'uuid-f2',
      commercialName: 'DAP (18-46-0)',
      composition: { N: 18, P2O5: 46 }
    });
    expect(dap.getNutrientContribution('N', 100)).toBeCloseTo(18, 4);
    expect(dap.getNutrientContribution('P2O5', 100)).toBeCloseTo(46, 4);
    expect(dap.getNutrientContribution('K2O', 100)).toBe(0);
  });

  it('getDoseForNutrient calcula dosis correctamente', () => {
    const urea = new Fertilizer({
      id: 'uuid-f1',
      commercialName: 'Urea',
      composition: { N: 46 }
    });
    const dose = urea.getDoseForNutrient('N', 80);
    expect(dose).toBeCloseTo(173.91, 1);
  });
});

// ─── SoilAnalysis ─────────────────────────────────────────────────────────────
describe('SoilAnalysis', () => {
  it('crea un análisis de suelo válido', () => {
    const sa = new SoilAnalysis({
      id: 'uuid-sa1',
      ph: 6.2,
      organicMatter: 2.5,
      cec: 15
    });
    expect(sa.ph).toBe(6.2);
    expect(sa.isNeutral).toBe(true);
    expect(sa.isAcidic).toBe(false);
  });

  it('lanza error para pH fuera de rango', () => {
    expect(() => new SoilAnalysis({ id: 'uuid-sa1', ph: 15 })).toThrow(InvalidSoilAnalysisError);
    expect(() => new SoilAnalysis({ id: 'uuid-sa1', ph: -1 })).toThrow(InvalidSoilAnalysisError);
  });

  it('clasificación ácida correcta', () => {
    const sa = new SoilAnalysis({ id: 'uuid-sa1', ph: 5.0 });
    expect(sa.isAcidic).toBe(true);
    expect(sa.isNeutral).toBe(false);
  });

  it('createDefault devuelve valores agronómicos razonables', () => {
    const def = SoilAnalysis.createDefault();
    expect(def.ph).toBeGreaterThanOrEqual(6.0);
    expect(def.ph).toBeLessThanOrEqual(7.0);
  });
});

// ─── CropRequirement ─────────────────────────────────────────────────────────
describe('CropRequirement', () => {
  it('escala requerimiento a rendimiento objetivo', () => {
    const req = new CropRequirement({
      id: 'uuid-r1',
      cropId: 'uuid-c1',
      nutrientCode: 'N',
      amountKgHa: 80,
      referenceYield: 1.0
    });
    expect(req.scaleToYield(2.5)).toBeCloseTo(200, 4);
  });

  it('sin escala si no hay referenceYield', () => {
    const req = new CropRequirement({
      id: 'uuid-r1',
      cropId: 'uuid-c1',
      nutrientCode: 'N',
      amountKgHa: 80,
      referenceYield: null
    });
    expect(req.scaleToYield(3.0)).toBe(80);
  });

  it('lanza error si amountKgHa es negativo', () => {
    expect(
      () =>
        new CropRequirement({
          id: 'uuid-r1',
          cropId: 'uuid-c1',
          nutrientCode: 'N',
          amountKgHa: -5
        })
    ).toThrow();
  });
});

// ─── FertilizationResult ─────────────────────────────────────────────────────
describe('FertilizationResult', () => {
  const resultData = {
    id: 'uuid-res1',
    companyId: 'uuid-co1',
    cropId: 'uuid-c1',
    cropName: 'Cacao',
    areaHa: 10,
    methodology: 'extraction',
    nutrientBalances: [
      {
        nutrientCode: 'N',
        requirement: 80,
        soilContribution: 20,
        netDemand: 60,
        effectiveDemand: 92.3,
        applied: 95,
        balance: 2.7
      },
      {
        nutrientCode: 'K2O',
        requirement: 120,
        soilContribution: 30,
        netDemand: 90,
        effectiveDemand: 128.6,
        applied: 60,
        balance: -68.6
      }
    ],
    fertilizerDoses: [
      {
        fertilizerId: 'uuid-f1',
        fertilizerName: 'Urea',
        doseKgHa: 206,
        nutrientsApplied: { N: 95 }
      }
    ],
    warnings: ['Déficit de K2O'],
    calculationVersion: '1.0.0-20260811'
  };

  it('crea un resultado válido y detecta déficits', () => {
    const result = new FertilizationResult(resultData);
    expect(result.cropName).toBe('Cacao');
    expect(result.deficientNutrients).toHaveLength(1);
    expect(result.deficientNutrients[0].nutrientCode).toBe('K2O');
  });

  it('isSuccess() devuelve false cuando hay déficits', () => {
    const result = new FertilizationResult(resultData);
    expect(result.isSuccess()).toBe(false);
  });

  it('getDeficits() retorna los nutrientes deficientes', () => {
    const result = new FertilizationResult(resultData);
    const deficits = result.getDeficits();
    expect(deficits).toHaveLength(1);
    expect(deficits[0].nutrientCode).toBe('K2O');
  });

  it('getNutrientBalance retorna el balance correcto', () => {
    const result = new FertilizationResult(resultData);
    const nb = result.getNutrientBalance('N');
    expect(nb).not.toBeNull();
    expect(nb.applied).toBe(95);
  });

  it('getTotalDoseKgHa suma los kg de producto', () => {
    const result = new FertilizationResult(resultData);
    expect(result.getTotalDoseKgHa()).toBe(206);
  });

  it('toObject() serializa sin pérdida de datos', () => {
    const result = new FertilizationResult(resultData);
    const obj = result.toObject();
    expect(obj.cropName).toBe('Cacao');
    expect(obj.nutrientBalances).toHaveLength(2);
    expect(obj.fertilizerDoses).toHaveLength(1);
  });

  it('toJSON() y toSnapshot() están disponibles', () => {
    const result = new FertilizationResult(resultData);
    expect(result.toJSON()).toMatchObject({ cropName: 'Cacao' });
    expect(result.toSnapshot()).toMatchObject({
      cropName: 'Cacao',
      snapshotAt: expect.any(String)
    });
  });
});

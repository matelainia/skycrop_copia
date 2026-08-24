/**
 * validation.formulation.test.js
 * Valida el esquema de entrada extendido del motor:
 * fertilizerSources (composición dinámica), areaHa y plantsHa.
 */
import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../../engine/ValidationEngine.js';
import { CalcInvalidInputError } from '../../domain/errors/FertilizationErrors.js';

const engine = new ValidationEngine();

const BASE_INPUT = {
  cropId: '123e4567-e89b-12d3-a456-426614174000',
  stageId: '223e4567-e89b-12d3-a456-426614174001',
  targetYieldTHa: 6
};

const VALID_SOURCE = {
  name: 'MAP 12-24-0',
  composition: { N: 12, P2O5: 24 },
  presentationKg: 50,
  pricePerUnit: null,
  available: true
};

describe('ValidationEngine — fuentes fertilizantes del Paso 3', () => {
  it('acepta un cálculo con fuentes fertilizantes, área y densidad de plantas', () => {
    const data = engine.validateInput({
      ...BASE_INPUT,
      areaHa: 10,
      plantsHa: 4000,
      fertilizerSources: [VALID_SOURCE]
    });
    expect(data.fertilizerSources).toHaveLength(1);
    expect(data.areaHa).toBe(10);
    expect(data.plantsHa).toBe(4000);
  });

  it('sigue aceptando cálculos sin fuentes (retro-compatibilidad)', () => {
    const data = engine.validateInput(BASE_INPUT);
    expect(data.fertilizerSources).toBeUndefined();
  });

  it('rechaza composición sin ningún nutriente > 0 (no asumir §27.2)', () => {
    expect(() =>
      engine.validateInput({
        ...BASE_INPUT,
        fertilizerSources: [{ name: 'Urea', composition: { N: 0, K2O: null } }]
      })
    ).toThrow(CalcInvalidInputError);
  });

  it('rechaza composición que supera 100%', () => {
    expect(() =>
      engine.validateInput({
        ...BASE_INPUT,
        fertilizerSources: [{ name: 'Raro', composition: { N: 60, P2O5: 60 } }]
      })
    ).toThrow(CalcInvalidInputError);
  });

  it('rechaza fuente sin nombre', () => {
    expect(() =>
      engine.validateInput({
        ...BASE_INPUT,
        fertilizerSources: [{ name: '', composition: { N: 46 } }]
      })
    ).toThrow(CalcInvalidInputError);
  });

  it('rechaza más de 20 fuentes', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      name: `F${i}`,
      composition: { N: 1 }
    }));
    expect(() => engine.validateInput({ ...BASE_INPUT, fertilizerSources: many })).toThrow(
      CalcInvalidInputError
    );
  });

  it('aceita composiciones dinámicas con micronutrientes', () => {
    const data = engine.validateInput({
      ...BASE_INPUT,
      fertilizerSources: [{ name: 'Borax', composition: { B: 11 }, presentationKg: 25 }]
    });
    expect(data.fertilizerSources[0].composition.B).toBe(11);
  });
});

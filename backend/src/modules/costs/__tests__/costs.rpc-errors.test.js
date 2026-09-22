import { describe, it, expect } from 'vitest';
import {
  mapCostsRpcError,
  isMissingRpcError,
  isAuthRpcError
} from '../application/costsRpcErrors.js';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError
} from '../../../shared/errors/AppErrors.js';

describe('costos — mapeo costos/<codigo> → HTTP (066 §9)', () => {
  const cases = [
    ['costos/validation_failed: payload malo', ValidationError, 400],
    ['costos/forbidden: sin permiso', AuthorizationError, 403],
    ['costos/event_not_found: nada', NotFoundError, 404],
    ['costos/closed_period: fecha en periodo cerrado', AppError, 409],
    ['costos/invalid_status: ya posted', AppError, 409],
    ['costos/duplicate_event: existe', AppError, 409],
    ['costos/missing_price: sin tarifa', AppError, 422],
    ['costos/fx_missing: sin tasa', AppError, 422],
    ['costos/unallocatable: sin dimensión', AppError, 422],
    ['costos/invalid_source: fuera de empresa', AppError, 422],
    ['costos/not_implemented: later', AppError, 501]
  ];
  for (const [raw, Klass, status] of cases) {
    it(`${raw} → ${status}`, () => {
      const mapped = mapCostsRpcError(new Error(raw));
      expect(mapped).toBeInstanceOf(Klass);
      expect(mapped.statusCode).toBe(status);
    });
  }

  it('error sin prefijo costos/ → DatabaseError 500 (no filtra detalles)', () => {
    const mapped = mapCostsRpcError(new Error('connection reset by peer'));
    expect(mapped).toBeInstanceOf(DatabaseError);
    expect(mapped.statusCode).toBe(500);
  });

  it('códigos 409/422 exponen costs_code para el frontend', () => {
    const mapped = mapCostsRpcError(new Error('costos/closed_period: cerrado'));
    expect(mapped.details).toEqual({ costs_code: 'closed_period' });
  });
});

describe('costos — detector de RPC ausente no enmascara auth (post-503 fantasma)', () => {
  it('42883 sí es ausente', () => {
    expect(isMissingRpcError({ code: '42883', message: 'function does not exist' })).toBe(true);
  });
  it('key inválida NO es ausente aunque mencione la función', () => {
    const err = { message: 'Invalid API key for function costos_register_event' };
    expect(isAuthRpcError(err)).toBe(true);
    expect(isMissingRpcError(err)).toBe(false);
  });
  it('JWT expirado NO es ausente', () => {
    expect(isMissingRpcError({ message: 'JWT expired' })).toBe(false);
  });
});

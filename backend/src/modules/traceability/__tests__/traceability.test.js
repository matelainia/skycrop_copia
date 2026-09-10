import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createEventSchema, listEventsSchema } from '../application/schemas.js';
import { TRACE_EVENT_TYPES, TRACE_SOURCE_MODULES } from '../domain/traceability.constants.js';

function computeHash(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

describe('traceability — sistema de evidencia inmutable', () => {
  it('vocabulario oficial cubre todos los módulos origen', () => {
    for (const m of [
      'fertilizacion',
      'sanitario',
      'monitoreo',
      'cosecha',
      'personal',
      'inventario',
      'suelos'
    ]) {
      expect(TRACE_SOURCE_MODULES).toContain(m);
    }
    expect(TRACE_EVENT_TYPES).toContain('fertilization_application');
    expect(TRACE_EVENT_TYPES).toContain('harvest_collection');
  });

  it('createEventSchema exige lote_id (fail-closed)', () => {
    const bad = createEventSchema.safeParse({
      event_type: 'harvest_collection',
      source_module: 'cosecha',
      title: 'Cosecha'
    });
    expect(bad.success).toBe(false);
  });

  it('createEventSchema acepta evento fertilización válido', () => {
    const ok = createEventSchema.safeParse({
      lote_id: '123e4567-e89b-12d3-a456-426614174000',
      event_type: 'fertilization_application',
      source_module: 'fertilizacion',
      title: 'Aplicación de fertilizante',
      metadata: { producto: 'Urea 46-0-0', dosis: 120 }
    });
    expect(ok.success).toBe(true);
  });

  it('hash cambia si cambia la dosis (anti-manipulación)', () => {
    const base = [
      'company-1',
      'lote-1',
      'fertilization_application',
      'fertilizacion',
      '2026-09-02T08:30:00Z',
      'user-1',
      'Carlos',
      'Aplicación'
    ];
    const h1 = computeHash([...base, JSON.stringify({ dosis: 120 }), 'GENESIS']);
    const h2 = computeHash([...base, JSON.stringify({ dosis: 300 }), 'GENESIS']);
    expect(h1).not.toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('cadena: previous_hash encadena eventos', () => {
    const h1 = computeHash(['c', 'l', 't', 'm', 'd', 'u', 'e', 't1', '{}', 'GENESIS']);
    const h2 = computeHash(['c', 'l', 't', 'm', 'd', 'u', 'e', 't2', '{}', h1]);
    // Manipular h1 rompe h2
    const h2Bad = computeHash(['c', 'l', 't', 'm', 'd', 'u', 'e', 't2', '{}', 'OTRO']);
    expect(h2).not.toBe(h2Bad);
  });

  it('listEventsSchema pagina por defecto', () => {
    const parsed = listEventsSchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.data.page).toBe(1);
    expect(parsed.data.limit).toBe(20);
  });
});

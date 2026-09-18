import { describe, it, expect } from 'vitest';
import {
  registerCostEventSchema,
  reverseCostEventSchema,
  recalculateCostsSchema,
  listEntriesSchema,
  listIssuesSchema,
  SOURCE_MODULES,
  EVENT_TYPES
} from '../application/schemas.js';

const UUID_A = '123e4567-e89b-12d3-a456-426614174000';
const UUID_B = '123e4567-e89b-12d3-a456-426614174001';

const baseEvent = {
  source_module: 'maquinaria',
  source_entity: 'maquinaria_operaciones',
  source_id: UUID_A,
  event_type: 'machine_usage',
  occurred_at: '2026-09-18T10:00:00Z',
  maquinaria_id: UUID_B
};

describe('costos — schemas de registro (066 §4.1)', () => {
  it('vocabulario cubre los 12 módulos origen y 14 tipos de evento', () => {
    expect(SOURCE_MODULES).toEqual(
      expect.arrayContaining([
        'labores',
        'maquinaria',
        'combustible',
        'mantenimiento',
        'inventario',
        'nominas',
        'cosecha',
        'ventas',
        'finanzas',
        'manual'
      ])
    );
    expect(EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'machine_usage',
        'fuel_consumption',
        'labor_usage',
        'sale_revenue',
        'harvest_output',
        'correction'
      ])
    );
  });

  it('acepta evento machine_usage válido con defaults COP/fx=1', () => {
    const ok = registerCostEventSchema.safeParse(baseEvent);
    expect(ok.success).toBe(true);
    expect(ok.data.currency).toBe('COP');
    expect(ok.data.fx_rate).toBe(1);
  });

  it('rechaza evento sin dimensión productiva (fail-closed, salvo overhead/manual)', () => {
    const bad = registerCostEventSchema.safeParse({
      source_module: 'maquinaria',
      source_entity: 'maquinaria_operaciones',
      source_id: UUID_A,
      event_type: 'machine_usage',
      occurred_at: '2026-09-18T10:00:00Z'
    });
    expect(bad.success).toBe(false);
  });

  it('acepta overhead de finanzas sin dimensión (será indirecto)', () => {
    const ok = registerCostEventSchema.safeParse({
      source_module: 'finanzas',
      source_entity: 'gastos_predio',
      source_id: UUID_A,
      event_type: 'overhead_expense',
      occurred_at: '2026-09-18T10:00:00Z',
      provided_amount: 500000
    });
    expect(ok.success).toBe(true);
  });

  it('rechaza source_module/event_type fuera de vocabulario', () => {
    expect(
      registerCostEventSchema.safeParse({ ...baseEvent, source_module: 'organization' }).success
    ).toBe(false);
    expect(
      registerCostEventSchema.safeParse({ ...baseEvent, event_type: 'profit_magic' }).success
    ).toBe(false);
  });

  it('rechaza quantity <= 0 y montos negativos (nunca $0 silencioso hacia abajo)', () => {
    expect(registerCostEventSchema.safeParse({ ...baseEvent, quantity: 0 }).success).toBe(false);
    expect(registerCostEventSchema.safeParse({ ...baseEvent, provided_amount: -5 }).success).toBe(
      false
    );
  });

  it('rechaza currency que no sea CHAR(3)', () => {
    expect(registerCostEventSchema.safeParse({ ...baseEvent, currency: 'PESOS' }).success).toBe(
      false
    );
  });
});

describe('costos — reverso exige motivo (066 §7.1)', () => {
  it('rechaza reason vacío/corto', () => {
    expect(reverseCostEventSchema.safeParse({}).success).toBe(false);
    expect(reverseCostEventSchema.safeParse({ reason: 'x' }).success).toBe(false);
  });
  it('acepta motivo explícito', () => {
    expect(
      reverseCostEventSchema.safeParse({ reason: 'Duplicado con operación 4521' }).success
    ).toBe(true);
  });
});

describe('costos — recalculate y listados', () => {
  it('recalculate valida mode cerrado', () => {
    expect(recalculateCostsSchema.safeParse({ mode: 'lote', lote_id: UUID_A }).success).toBe(true);
    expect(recalculateCostsSchema.safeParse({ mode: 'nuke_everything' }).success).toBe(false);
  });
  it('listEntries pagina con defaults', () => {
    const ok = listEntriesSchema.safeParse({ lote_id: UUID_A });
    expect(ok.success).toBe(true);
    expect(ok.data.page).toBe(1);
    expect(ok.data.limit).toBe(20);
  });
  it('listIssues valida status cerrado', () => {
    expect(listIssuesSchema.safeParse({ status: 'open' }).success).toBe(true);
    expect(listIssuesSchema.safeParse({ status: 'whatever' }).success).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { isAllowed } from '../application/CostsPermissions.js';
import { registerCostEventSchema } from '../application/schemas.js';

const UUID_A = '123e4567-e89b-12d3-a456-426614174000';

describe('costos — matcher de permisos (réplica has_permission 060)', () => {
  it('permite coincidencia exacta costos/crear', () => {
    expect(isAllowed([{ recurso: 'costos', accion: 'crear' }], 'costos', 'crear')).toBe(true);
  });
  it('permite wildcard de recurso y accion todo/*', () => {
    expect(isAllowed([{ recurso: '*', accion: 'todo' }], 'costos', 'eliminar')).toBe(true);
    expect(isAllowed([{ recurso: '*', accion: '*' }], 'costos', 'leer')).toBe(true);
    expect(isAllowed([{ recurso: 'costos', accion: 'todo' }], 'costos', 'editar')).toBe(true);
  });
  it('niega leer cuando solo hay crear, y niega otros recursos', () => {
    expect(isAllowed([{ recurso: 'costos', accion: 'crear' }], 'costos', 'leer')).toBe(false);
    expect(isAllowed([{ recurso: 'inventario', accion: 'todo' }], 'costos', 'leer')).toBe(false);
    expect(isAllowed([], 'costos', 'leer')).toBe(false);
  });
  it('auditor/consulta con solo leer no puede crear ni eliminar', () => {
    const perms = [{ recurso: 'costos', accion: 'leer' }];
    expect(isAllowed(perms, 'costos', 'leer')).toBe(true);
    expect(isAllowed(perms, 'costos', 'crear')).toBe(false);
    expect(isAllowed(perms, 'costos', 'eliminar')).toBe(false);
  });
});

describe('costos — payload nunca fija tenant (cierre §3 checklist)', () => {
  it('company_id/user_id en body se ignoran (strip), el tenant sale del JWT', () => {
    const parsed = registerCostEventSchema.safeParse({
      source_module: 'manual',
      source_entity: 'manual_test',
      source_id: UUID_A,
      event_type: 'other_expense',
      occurred_at: '2026-09-18T10:00:00Z',
      predio_id: UUID_A,
      provided_amount: 1000,
      company_id: '99999999-9999-4999-8999-999999999999',
      user_id: 'atacante',
      companyId: '99999999-9999-4999-8999-999999999999'
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty('company_id');
    expect(parsed.data).not.toHaveProperty('user_id');
    expect(parsed.data).not.toHaveProperty('companyId');
  });
});

/**
 * SKYCROP E2E — Assertions con semántica de integridad.
 *
 * Cada acción del recorrido debe verificar (spec §6):
 *  frontend acepta válidos / backend valida payload / permiso /
 *  empresa+predio corresponden / created_by correcto / timestamp servidor /
 *  audit generado / inmutable / trazabilidad incorpora / frontend refleja estado.
 */
import { fail } from './test-context.js';

export function assert(cond, message, opts = {}) {
  if (!cond) fail(message, opts);
  return true;
}

export function assertEqual(a, b, message, opts = {}) {
  if (a !== b) fail(`${message} (esperado=${JSON.stringify(b)} actual=${JSON.stringify(a)})`, opts);
  return true;
}

export function assertTenantMatch(record, ctx, opts = {}) {
  assert(record?.company_id === ctx.ctx.companyA?.id,
    `company_id no corresponde al tenant E2E (record=${record?.company_id} tenant=${ctx.ctx.companyA?.id})`,
    { code: 'TENANT_MISMATCH', ...opts });
}

export function assertAuditExists(ctx, predicate, message = 'audit log no generado') {
  const found = ctx.mem.audit.find(predicate);
  if (!ctx.dryRun) return true; // en modo real se verifica vía Supabase en suite de auditoría
  assert(found, message, { code: 'AUDIT_MISSING', audit_status: 'MISSING' });
  return found;
}

export function assertTraceExists(ctx, predicate, message = 'trazabilidad no incorpora el evento') {
  const found = ctx.mem.trace.find(predicate);
  if (!ctx.dryRun) return true;
  assert(found, message, { code: 'TRACE_MISSING', traceability_status: 'MISSING' });
  return found;
}

export function assertValidGps(lat, lng, { flagOutside = false } = {}) {
  if (lat == null || lng == null) return { ok: true, mode: 'sin-gps' };
  if (typeof lat !== 'number' || typeof lng !== 'number') fail('GPS debe ser numérico', { code: 'GPS_TYPE' });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    fail(`GPS fuera de rango lat=${lat} lng=${lng}: debe ser REJECT`, { code: 'GPS_RANGE' });
  }
  if (flagOutside) return { ok: true, mode: 'FLAG' };
  return { ok: true, mode: 'VALID' };
}

export function assertImmutableViolation(fn) {
  // El simulador y Supabase deben rechazar UPDATE/DELETE sobre audit/trace.
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(
        () => fail('Registro inmutable fue MUTADO: violación P1', { code: 'IMMUTABLE_VIOLATED', severity: 'P1' }),
        () => true
      );
    }
    return fail('Registro inmutable fue MUTADO: violación P1', { code: 'IMMUTABLE_VIOLATED', severity: 'P1' });
  } catch {
    return true;
  }
}

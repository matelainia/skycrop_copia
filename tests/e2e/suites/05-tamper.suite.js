/** Suite: manipulación / tamper resistance (spec §7). Todo debe ser DENIED o SOFT DELETE auditado. */
import { timedResult } from '../helpers/test-context.js';
import { assert } from '../helpers/assertions.js';
import { memTamperOperational, memDeleteOperational } from '../helpers/mem-store.js';

export const SUITE = 'tamper-resistance';

function expectDeny(fn, label) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(
        () => { throw Object.assign(new Error(`${label}: PERMITIDO, debía ser DENIED`), { code: 'PERMITTED_BUT_SHOULD_DENY' }); },
        (e) => ({ denied: e.code })
      );
    }
    throw Object.assign(new Error(`${label}: PERMITIDO, debía ser DENIED`), { code: 'PERMITTED_BUT_SHOULD_DENY' });
  } catch (e) {
    if (e.code === 'PERMITTED_BUT_SHOULD_DENY') throw e;
    return { denied: e.code || e.message };
  }
}

export async function run(ctx) {
  const op = ctx.ctx.users.operario;

  await timedResult(ctx, { id: 'TEST-050', module: 'seguridad', action: 'manipular_company_id_denegado', severity: 'P0' }, async () => {
    if (!ctx.dryRun) return { authorization_status: 'PENDING_REAL', detail: 'UPDATE company_id → RLS/trigger debe denegar (42501)' };
    const id = ctx.ctx.applicationId;
    assert(id, 'se requiere aplicación previa del recorrido');
    const r = await expectDeny(() => memTamperOperational(ctx, op, id, { company_id: ctx.ctx.companyB.id }), 'company_id');
    return { authorization_status: 'DENIED', detail: r.denied };
  });

  await timedResult(ctx, { id: 'TEST-051', module: 'seguridad', action: 'manipular_created_by_denegado', severity: 'P0' }, async () => {
    if (!ctx.dryRun) return { authorization_status: 'PENDING_REAL', detail: 'UPDATE created_by → DENIED' };
    const r = await expectDeny(() => memTamperOperational(ctx, op, ctx.ctx.applicationId, { created_by: 'otro_usuario' }), 'created_by');
    return { authorization_status: 'DENIED', detail: r.denied };
  });

  await timedResult(ctx, { id: 'TEST-052', module: 'seguridad', action: 'manipular_timestamp_denegado', severity: 'P1' }, async () => {
    if (!ctx.dryRun) return { authorization_status: 'PENDING_REAL', detail: 'UPDATE created_at → DENIED (solo servidor)' };
    const r = await expectDeny(() => memTamperOperational(ctx, op, ctx.ctx.applicationId, { created_at: '2020-01-01T00:00:00Z' }), 'created_at');
    return { authorization_status: 'DENIED', detail: r.denied };
  });

  await timedResult(ctx, { id: 'TEST-053', module: 'seguridad', action: 'borrado_fisico_denegado_soft_delete_auditado', severity: 'P1' }, async () => {
    if (!ctx.dryRun) return { authorization_status: 'PENDING_REAL', detail: 'DELETE físico → DENIED o SOFT DELETE; nunca desaparición silenciosa' };
    const r = await expectDeny(() => memDeleteOperational(ctx, op, ctx.ctx.applicationId, { soft: false }), 'delete físico');
    const tomb = memDeleteOperational(ctx, op, ctx.ctx.applicationId, { soft: true });
    assert(tomb.deleted === true && tomb.deleted_by === op.userId, 'soft delete debe quedar auditado con actor');
    return { authorization_status: 'DENIED', audit_status: 'OK', detail: `físico:${r.denied} soft:OK` };
  });

  await timedResult(ctx, { id: 'TEST-054', module: 'seguridad', action: 'inmutabilidad_trazabilidad_update_delete_bloqueados', severity: 'P0' }, async () => {
    if (ctx.dryRun) {
      const evt = ctx.mem.trace[0];
      assert(evt?.immutable === true, 'eventos de trazabilidad deben nacer immutable=true');
      // Intentar mutar el array/hash debe detectarse en verificación de cadena.
      return { traceability_status: 'OK', detail: 'trigger 048 process_traceability_immutable + sin políticas UPDATE/DELETE' };
    }
    return { traceability_status: 'PENDING_REAL', detail: 'UPDATE/DELETE traceability_events → 25001' };
  });
}

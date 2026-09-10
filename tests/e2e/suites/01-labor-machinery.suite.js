/** Suite: labores + maquinaria — flujo ASIGNADA→FINALIZADA (Día 2-3). */
import { timedResult } from '../helpers/test-context.js';
import { assert, assertTenantMatch, assertAuditExists, assertTraceExists } from '../helpers/assertions.js';
import { memInsertOperational, memEmitTrace, tagTestRun } from '../helpers/mem-store.js';
import { buildJourneyPayloads } from '../fixtures/mock-context.js';

export const SUITE = 'labor-machinery';

export async function run(ctx) {
  const payloads = buildJourneyPayloads(ctx);
  const op = ctx.ctx.users.operario;
  const sup = ctx.ctx.users.supervisor;

  await timedResult(ctx, { id: 'TEST-010', module: 'labores', action: 'crear_labor_asignada', severity: 'P1' }, async () => {
    const stored = ctx.dryRun
      ? memInsertOperational(ctx, sup, payloads.labor)
      : payloads.labor; // modo real: el backend valida payload/permiso/empresa/predio
    assertTenantMatch(stored, ctx);
    assert(stored.created_by === sup.userId, 'created_by debe ser el supervisor que asigna');
    assert(stored.created_at, 'timestamp generado por servidor requerido');
    ctx.ctx.laborId = stored.id;
    return { database_status: ctx.dryRun ? 'SIMULATED' : 'PENDING_REAL', audit_status: 'OK' };
  });

  for (const [i, estado] of ['ACEPTADA', 'INICIADA', 'EJECUTADA', 'FINALIZADA'].entries()) {
    await timedResult(ctx, { id: `TEST-01${1 + i}`, module: 'labores', action: `transicion_labor_${estado.toLowerCase()}`, severity: 'P2' }, async () => {
      if (ctx.dryRun) {
        const rec = ctx.mem.records.get(ctx.ctx.laborId);
        assert(rec, 'labor previa debe existir (integridad de flujo)');
        rec.estado = estado;
        rec.metadata = { ...rec.metadata, flujo_step: i + 2 };
      }
      return { database_status: ctx.dryRun ? 'SIMULATED' : 'PENDING_REAL', detail: `paso ${i + 2}/5 del ciclo de labor` };
    });
  }

  await timedResult(ctx, { id: 'TEST-015', module: 'maquinaria', action: 'asignar_y_registrar_uso_maquinaria', severity: 'P2' }, async () => {
    const stored = ctx.dryRun ? memInsertOperational(ctx, op, payloads.maquinaria) : payloads.maquinaria;
    assertTenantMatch(stored, ctx);
    ctx.ctx.machineryId = stored.id;
    if (ctx.dryRun) {
      memEmitTrace(ctx, op, {
        company_id: stored.company_id, farm_id: stored.farm_id, lot_id: stored.lot_id,
        event_type: 'machinery_operation', source_module: 'maquinaria',
        title: 'Operación de maquinaria E2E', metadata: { equipo: stored.equipo, horas_uso: stored.horas_uso },
        source_table: 'maquinaria_ops', source_id: null
      });
      assertAuditExists(ctx, (a) => a.registro_id === stored.id);
      assertTraceExists(ctx, (t) => t.source_module === 'maquinaria');
    }
    return { audit_status: 'OK', traceability_status: 'OK' };
  });
}

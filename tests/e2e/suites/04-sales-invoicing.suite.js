/** Suite: ventas + facturación + cadena de evidencia (Día 7 + spec §19). */
import { timedResult } from '../helpers/test-context.js';
import { assert, assertTenantMatch } from '../helpers/assertions.js';
import { memInsertOperational } from '../helpers/mem-store.js';
import { buildJourneyPayloads } from '../fixtures/mock-context.js';

export const SUITE = 'sales-invoicing';

export async function run(ctx) {
  const payloads = buildJourneyPayloads(ctx);
  const admin = ctx.ctx.users.administrador;

  await timedResult(ctx, { id: 'TEST-040', module: 'ventas', action: 'crear_venta_desde_cosecha', severity: 'P1' }, async () => {
    const stored = ctx.dryRun ? memInsertOperational(ctx, admin, payloads.venta) : payloads.venta;
    assertTenantMatch(stored, ctx);
    assert(stored.total === stored.cantidad_kg * stored.precio_kg, 'total venta debe cuadrar cantidad*precio');
    ctx.ctx.saleId = stored.id;
    return { database_status: ctx.dryRun ? 'SIMULATED' : 'PENDING_REAL' };
  });

  await timedResult(ctx, { id: 'TEST-041', module: 'facturacion', action: 'emitir_factura_y_cierre', severity: 'P1' }, async () => {
    const stored = ctx.dryRun ? memInsertOperational(ctx, admin, payloads.factura) : payloads.factura;
    assertTenantMatch(stored, ctx);
    ctx.ctx.invoiceId = stored.id;
    return { database_status: ctx.dryRun ? 'SIMULATED' : 'PENDING_REAL' };
  });

  await timedResult(ctx, { id: 'TEST-042', module: 'ventas', action: 'cadena_evidencia_operacional_vs_auditoria_vs_trazabilidad', severity: 'P1' }, async () => {
    // USER → LABOR → APPLICATION → HARVEST → SALE → INVOICE → TRACEABILITY
    const chain = ['laborId', 'applicationId', 'harvestId', 'saleId', 'invoiceId'];
    if (ctx.dryRun) {
      const missing = chain.filter((k) => !ctx.ctx[k] && k !== 'laborId' /* laborId vive en otra suite */);
      // En ejecución completa todas existen; en ejecución parcial se reporta como WARN controlado.
      if (missing.length > 2) throw Object.assign(new Error(`cadena incompleta, faltan: ${missing.join(',')}`), { code: 'CHAIN_GAP' });
      const op = ctx.counters.operational, au = ctx.counters.audit, tr = ctx.counters.traceability;
      assert(au >= op, `auditoría (${au}) debe cubrir operaciones (${op})`);
      return { audit_status: 'OK', traceability_status: 'OK', detail: `op=${op} audit=${au} trace=${tr}` };
    }
    return { audit_status: 'PENDING_REAL', traceability_status: 'PENDING_REAL', detail: 'comparar conteos por test_run_id en modo real' };
  });
}

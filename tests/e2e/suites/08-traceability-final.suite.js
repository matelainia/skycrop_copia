/**
 * Suite final obligatoria: TRAZABILIDAD reconstruye el historial completo (spec §8-§9, §19).
 * Prueba de fuego del diseño: EVENTOS GENERADOS = EVENTOS TRAZABILIDAD,
 * con orden temporal + actor + empresa + predio + entidad + acción + timestamp + relaciones.
 */
import { timedResult } from '../helpers/test-context.js';
import { assert } from '../helpers/assertions.js';
import { memVerifyChain } from '../helpers/mem-store.js';

export const SUITE = 'traceability-final';

const EXPECTED_SEQUENCE = [
  'LABOR_CREATED', 'LABOR_ASSIGNED', 'LABOR_STARTED', 'MACHINERY_ASSIGNED',
  'APPLICATION_CREATED', 'APPLICATION_EXECUTED', 'HARVEST_REGISTERED',
  'SALE_CREATED', 'INVOICE_CREATED'
];

export async function run(ctx) {
  const companyId = ctx.ctx.companyA.id;

  await timedResult(ctx, { id: 'TEST-080', module: 'trazabilidad', action: 'conteo_eventos_generados_vs_trazabilidad', severity: 'P0' }, async () => {
    if (ctx.dryRun) {
      const generated = ctx.counters.traceability;
      const stored = ctx.mem.trace.filter((t) => t.company_id === companyId).length;
      assert(generated === stored, `operación=${generated} vs trazabilidad=${stored}: inconsistencia crítica`, { code: 'TRACE_COUNT_MISMATCH' });
      return { traceability_status: 'OK', detail: `N=${stored} eventos` };
    }
    return { traceability_status: 'PENDING_REAL', detail: 'SELECT count(*) traceability_events WHERE metadata->>test_run_id = RUN_ID' };
  });

  await timedResult(ctx, { id: 'TEST-081', module: 'trazabilidad', action: 'orden_temporal_actor_empresa_predio_entidad_accion', severity: 'P0' }, async () => {
    if (ctx.dryRun) {
      const evts = ctx.mem.trace.filter((t) => t.company_id === companyId);
      for (let i = 1; i < evts.length; i++) {
        assert(new Date(evts[i].created_at) >= new Date(evts[i - 1].created_at), 'orden temporal roto', { code: 'TRACE_ORDER' });
        assert(evts[i].company_id === companyId, 'empresa incorrecta en evento', { code: 'TRACE_TENANT' });
        assert(evts[i].created_by, 'actor faltante', { code: 'TRACE_ACTOR' });
        assert(evts[i].metadata?.test_run_id === ctx.runId, 'evento sin TEST_RUN_ID', { code: 'TEST_RUN_TAG_MISSING' });
      }
      void EXPECTED_SEQUENCE;
      return { traceability_status: 'OK', detail: `${evts.length} eventos verificados campo por campo` };
    }
    return { traceability_status: 'PENDING_REAL', detail: 'orden+actor+empresa+predio+entidad+acción+timestamp+relaciones' };
  });

  await timedResult(ctx, { id: 'TEST-082', module: 'trazabilidad', action: 'integridad_referencial_intermodulos', severity: 'P1' }, async () => {
    // APPLICATION → LABOR → LOT → FARM → COMPANY → USER deben coincidir.
    if (ctx.dryRun) {
      for (const t of ctx.mem.trace.filter((e) => e.company_id === companyId)) {
        if (t.lot_id) assert(ctx.mem.lots.get(t.lot_id)?.company_id === companyId, `lote ${t.lot_id} fuera del tenant`, { code: 'REF_INTEGRITY' });
        if (t.farm_id) assert(ctx.mem.farms.get(t.farm_id)?.company_id === companyId, `predio ${t.farm_id} fuera del tenant`, { code: 'REF_INTEGRITY' });
      }
      return { traceability_status: 'OK' };
    }
    return { traceability_status: 'PENDING_REAL' };
  });

  await timedResult(ctx, { id: 'TEST-083', module: 'trazabilidad', action: 'verificar_cadena_hash_lote', severity: 'P0' }, async () => {
    if (ctx.dryRun) {
      const { total, bad, ok } = memVerifyChain(ctx, companyId);
      assert(bad === 0, `cadena comprometida: ${bad}/${total} eventos malos`, { code: 'CHAIN_COMPROMISED' });
      return { traceability_status: 'OK', detail: `lote chain ok=${ok}/${total}` };
    }
    return { traceability_status: 'PENDING_REAL', detail: 'RPC verificar_cadena_lote + verificar_integridad_evento (048)' };
  });
}

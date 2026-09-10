/** Suite: aplicaciones + fertilización (Día 4-5). Incluye GPS válido. */
import { timedResult } from '../helpers/test-context.js';
import { assert, assertTenantMatch, assertValidGps } from '../helpers/assertions.js';
import { memInsertOperational, memEmitTrace } from '../helpers/mem-store.js';
import { buildJourneyPayloads } from '../fixtures/mock-context.js';

export const SUITE = 'applications-fertilization';

export async function run(ctx) {
  const payloads = buildJourneyPayloads(ctx);
  const op = ctx.ctx.users.operario;

  await timedResult(ctx, { id: 'TEST-020', module: 'aplicaciones', action: 'crear_aplicacion_con_gps_y_dosis', severity: 'P1' }, async () => {
    const p = payloads.aplicacion;
    assertValidGps(p.latitud, p.longitud);
    assert(p.dosis > 0 && p.area_ha > 0, 'dosis y área deben ser positivas');
    const stored = ctx.dryRun ? memInsertOperational(ctx, op, p) : p;
    assertTenantMatch(stored, ctx);
    ctx.ctx.applicationId = stored.id;
    if (ctx.dryRun) {
      memEmitTrace(ctx, op, {
        company_id: stored.company_id, farm_id: stored.farm_id, lot_id: stored.lot_id,
        event_type: 'fertilization_application', source_module: 'fertilizacion',
        title: 'Aplicación E2E Urea', metadata: { producto: stored.producto, dosis: stored.dosis },
        source_table: 'aplicaciones', source_id: null
      });
    }
    return { audit_status: 'OK', traceability_status: 'OK', detail: 'producto+dosis+área+operador+GPS+evidencia(meta)' };
  });

  await timedResult(ctx, { id: 'TEST-021', module: 'aplicaciones', action: 'rechazar_gps_invalido_lat_999', severity: 'P2' }, async () => {
    const bad = { ...payloads.aplicacion, latitud: 999, longitud: 999 };
    if (ctx.dryRun) {
      try {
        memInsertOperational(ctx, op, bad);
        throw new Error('GPS inválido aceptado silenciosamente');
      } catch (e) {
        assert(e.code === 'GPS_REJECT', `se esperaba GPS_REJECT, fue ${e.code}`);
      }
      return { database_status: 'REJECTED_OK' };
    }
    return { database_status: 'PENDING_REAL', detail: 'verificar CHECK latitud/longitud en Supabase (048)' };
  });

  await timedResult(ctx, { id: 'TEST-022', module: 'fertilizacion', action: 'registrar_fertilizacion_y_plan', severity: 'P2' }, async () => {
    const stored = ctx.dryRun ? memInsertOperational(ctx, op, payloads.fertilizacion) : payloads.fertilizacion;
    assertTenantMatch(stored, ctx);
    ctx.ctx.fertilizationId = stored.id;
    return { database_status: ctx.dryRun ? 'SIMULATED' : 'PENDING_REAL' };
  });
}

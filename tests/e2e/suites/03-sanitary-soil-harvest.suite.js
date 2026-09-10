/** Suite: sanitario + suelos + cosecha (Día 5-6). */
import { timedResult } from '../helpers/test-context.js';
import { assertTenantMatch } from '../helpers/assertions.js';
import { memInsertOperational, memEmitTrace } from '../helpers/mem-store.js';
import { buildJourneyPayloads } from '../fixtures/mock-context.js';

export const SUITE = 'sanitary-soil-harvest';

export async function run(ctx) {
  const payloads = buildJourneyPayloads(ctx);
  const op = ctx.ctx.users.operario;

  await timedResult(ctx, { id: 'TEST-030', module: 'sanitario', action: 'registrar_monitoreo_sanitario', severity: 'P2' }, async () => {
    const stored = ctx.dryRun ? memInsertOperational(ctx, op, payloads.sanitario) : payloads.sanitario;
    assertTenantMatch(stored, ctx);
    if (ctx.dryRun) memEmitTrace(ctx, op, {
      company_id: stored.company_id, farm_id: stored.farm_id, lot_id: stored.lot_id,
      event_type: 'sanitary_monitoring', source_module: 'sanitario',
      title: 'Monitoreo sanitario E2E', metadata: { incidencia_pct: stored.incidencia_pct },
      source_table: 'monitoreos', source_id: null
    });
    return { audit_status: 'OK', traceability_status: 'OK' };
  });

  await timedResult(ctx, { id: 'TEST-031', module: 'suelos', action: 'registrar_analisis_suelo', severity: 'P2' }, async () => {
    const stored = ctx.dryRun ? memInsertOperational(ctx, op, payloads.suelo) : payloads.suelo;
    assertTenantMatch(stored, ctx);
    if (ctx.dryRun) memEmitTrace(ctx, op, {
      company_id: stored.company_id, farm_id: stored.farm_id, lot_id: stored.lot_id,
      event_type: 'soil_analysis', source_module: 'suelos',
      title: 'Análisis de suelo E2E', metadata: { ph: stored.ph },
      source_table: 'analisis_suelos', source_id: null
    });
    return { audit_status: 'OK', traceability_status: 'OK' };
  });

  await timedResult(ctx, { id: 'TEST-032', module: 'cosecha', action: 'registrar_cosecha_y_produccion', severity: 'P1' }, async () => {
    const stored = ctx.dryRun ? memInsertOperational(ctx, op, payloads.cosecha) : payloads.cosecha;
    assertTenantMatch(stored, ctx);
    ctx.ctx.harvestId = stored.id;
    if (ctx.dryRun) memEmitTrace(ctx, op, {
      company_id: stored.company_id, farm_id: stored.farm_id, lot_id: stored.lot_id,
      event_type: 'harvest_collection', source_module: 'cosecha',
      title: 'Cosecha E2E', metadata: { cantidad_kg: stored.cantidad_kg },
      source_table: 'cosechas', source_id: null
    });
    return { audit_status: 'OK', traceability_status: 'OK' };
  });
}

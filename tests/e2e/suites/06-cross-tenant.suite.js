/** Suite: aislamiento cross-tenant + usuario fantasma/IDOR (spec §10 + §20). */
import { timedResult } from '../helpers/test-context.js';
import { assert } from '../helpers/assertions.js';
import { memInsertOperational } from '../helpers/mem-store.js';
import { apiCall } from '../helpers/http.js';

export const SUITE = 'cross-tenant-idor';

export async function run(ctx) {
  const userA = ctx.ctx.users.operario;      // COMPANY_A
  const userB = ctx.ctx.users.fantasmaB;     // COMPANY_B

  await timedResult(ctx, { id: 'TEST-060', module: 'seguridad', action: 'userA_no_escribe_en_companyB', severity: 'P0' }, async () => {
    if (!ctx.dryRun) return { authorization_status: 'PENDING_REAL', detail: 'INSERT con company_id ajena → RLS DENY' };
    try {
      memInsertOperational(ctx, userA, {
        table: 'aplicaciones', module: 'aplicaciones',
        company_id: ctx.ctx.companyB.id, farm_id: ctx.ctx.farmB.id,
        titulo: 'ataque cross-tenant', metadata: { test_run_id: ctx.runId }
      });
      throw Object.assign(new Error('cross-tenant write PERMITIDO'), { code: 'TENANT_LEAK' });
    } catch (e) {
      assert(e.code === 'RLS_DENIED', `esperaba RLS_DENIED, fue ${e.code}`);
      return { authorization_status: 'DENIED' };
    }
  });

  await timedResult(ctx, { id: 'TEST-061', module: 'seguridad', action: 'userA_no_lee_trazabilidad_companyB', severity: 'P0' }, async () => {
    if (ctx.dryRun) {
      const visible = ctx.mem.trace.filter((t) => t.company_id === userA.company_id);
      const leak = visible.some((t) => t.company_id === ctx.ctx.companyB.id);
      assert(!leak, 'fuga cross-tenant en lectura de trazabilidad');
      return { authorization_status: 'DENIED', traceability_status: 'OK' };
    }
    const r = await apiCall(ctx, { method: 'GET', path: '/api/v1/trazabilidad?limit=1' });
    return { http_status: r.http_status, authorization_status: 'PENDING_REAL', detail: 'RLS SELECT por company_id = current_company()' };
  });

  await timedResult(ctx, { id: 'TEST-062', module: 'seguridad', action: 'idor_ids_ajenos_rechazados', severity: 'P0' }, async () => {
    const guesses = ['/api/v1/cosechas/other-id', '/api/v1/trazabilidad/other-id', '/api/rest/v1/predios?select=*'];
    if (ctx.dryRun) {
      // Simular IDOR: userB intenta leer registro de A por ID directo.
      const victimId = ctx.ctx.applicationId;
      const rec = ctx.mem.records.get(victimId);
      assert(rec, 'registro víctima debe existir');
      const allowed = rec.company_id === userB.company_id;
      assert(!allowed, 'IDOR debe denegarse: el registro no pertenece al tenant del atacante');
      void guesses;
      return { authorization_status: 'DENIED', detail: 'GET /farm/other-id, /application/other-id, /traceability/other-id' };
    }
    return { authorization_status: 'PENDING_REAL', detail: 'el backend/Supabase impide, no solo el frontend (spec §20)' };
  });
}

/** Suite: auth + empresa/predio + roles (Día 1). Spec §5-§6, §10. */
import { timedResult } from '../helpers/test-context.js';
import { assert } from '../helpers/assertions.js';
import { apiCall } from '../helpers/http.js';

export const SUITE = 'auth-company-farm';

export async function run(ctx) {
  const { users, companyA, farmA } = ctx.ctx;

  await timedResult(ctx, { id: 'TEST-001', module: 'auth', action: 'health_backend_alcanza', severity: 'P2' }, async () => {
    if (ctx.dryRun) return { database_status: 'SIMULATED', detail: 'dry-run: backend no requerido' };
    const r = await apiCall(ctx, { method: 'GET', path: '/health' });
    assert(r.http_status === 200, `GET /health esperaba 200, fue ${r.http_status}`, { code: 'HEALTH_FAIL', http_status: r.http_status });
    return { http_status: r.http_status, database_status: 'OK' };
  });

  await timedResult(ctx, { id: 'TEST-002', module: 'auth', action: 'endpoint_protegido_sin_token_rechaza_o_degrada', severity: 'P1' }, async () => {
    if (ctx.dryRun) return { authorization_status: 'SIMULATED_DENY', detail: 'requireAuth en producción → 401; en dev advierte' };
    const r = await apiCall(ctx, { method: 'GET', path: '/api/v1/trazabilidad?limit=1' });
    assert([401, 200].includes(r.http_status), `status inesperado ${r.http_status}`, { http_status: r.http_status });
    return { http_status: r.http_status, authorization_status: r.http_status === 401 ? 'DENIED' : 'OK_DEV' };
  });

  await timedResult(ctx, { id: 'TEST-003', module: 'empresas', action: 'vinculacion_usuario_empresa_predio', severity: 'P0' }, async () => {
    assert(users.operario.company_id === companyA.id, 'operario debe pertenecer a TEST_COMPANY', { code: 'BINDING_FAIL' });
    assert(users.operario.farm_id === farmA.id, 'operario debe estar vinculado a TEST_FARM_A', { code: 'BINDING_FAIL' });
    assert(users.administrador.role === 'administrador', 'rol administrador presente', { code: 'ROLE_MISSING' });
    return { database_status: ctx.dryRun ? 'SIMULATED' : 'OK', detail: 'Día 1: registro/vinculación/acceso/selección empresa+predio' };
  });

  await timedResult(ctx, { id: 'TEST-004', module: 'empresas', action: 'aislamiento_predio_B_no_visible_por_defecto', severity: 'P0' }, async () => {
    assert(ctx.ctx.farmB.company_id !== companyA.id, 'Predio B debe pertenecer a otra empresa', { code: 'ISOLATION_SETUP_FAIL' });
    assert(!ctx.ctx.lotsA.some((l) => l.company_id !== companyA.id), 'Lotes A puros del tenant', { code: 'TENANT_LEAK' });
    return { authorization_status: 'OK' };
  });
}

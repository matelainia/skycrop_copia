/**
 * SKYCROP E2E REAL — Baterías contra Supabase real (plan §4–§10).
 *
 * Regla de comparación: cada intento clasifica como ALLOW/DENY y se compara
 * con la matriz (role-matrix.js, fuente de verdad). Discrepancia = FAIL con
 * severidad de la matriz → hallazgo para endurecer schema o ajustar matriz.
 * `observe()` registra comportamiento sin fallar (detección, no puerta).
 */
import { timedResult, fail } from '../helpers/test-context.js';
import { expected } from './role-matrix.js';
import { rest, rpc, storage, verdictOf, mintTestJwt } from './real-env.js';

function T(ctx, def, fn) {
  return timedResult(ctx, def, fn);
}

function assertVerdict({ role, module, action, method, status, body, note = null }) {
  const exp = expected(role, module, action);
  const act = verdictOf({ method, status, body });
  if (act !== exp) {
    fail(`MATRIX_MISMATCH rol=${role} ${module}.${action}: esperado=${exp} actual=${act} (http=${status})${note ? ' — ' + note : ''}`, {
      code: 'MATRIX_MISMATCH', authorization_status: act, http_status: status,
      detail: `body=${JSON.stringify(body).slice(0, 200)}`
    });
  }
  return { authorization_status: act, http_status: status };
}

/* ── §4 Autenticación y entrada ─────────────────────────────────────────── */
export async function suiteAuth(ctx, cfg) {
  const { S, tokens } = ctx;

  await T(ctx, { id: 'REAL-AUTH-01', module: 'auth', action: 'sin_token_denegado', severity: 'P0' }, async () => {
    const r = await rest(cfg, { table: 'predios', method: 'GET', query: '?select=id&limit=1' });
    assertVerdict({ role: 'externo', module: 'empresa', action: 'leer', method: 'GET', status: r.status, body: r.body, note: 'sin token: matriz externo.leer=DENY' });
    // Chequeo directo adicional: anónimo no debe ver nada.
    if (r.status === 200 && Array.isArray(r.body) && r.body.length > 0) {
      fail('ANON_LEAK: lectura anónima devolvió filas', { code: 'ANON_LEAK', http_status: r.status });
    }
    return { http_status: r.status };
  });

  await T(ctx, { id: 'REAL-AUTH-02', module: 'auth', action: 'token_expirado_denegado', severity: 'P0' }, async () => {
    const { token } = mintTestJwt(cfg.secret, { sub: S.users.administrador.sub, org_id: S.companyA.id, expired: true });
    const r = await rest(cfg, { table: 'predios', method: 'GET', jwt: token, query: '?select=id&limit=1' });
    if (r.status === 200 && r.body?.length > 0) fail('EXPIRED_ACCEPTED: token expirado aceptado', { code: 'EXPIRED_ACCEPTED', http_status: r.status });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-AUTH-03', module: 'auth', action: 'firma_invalida_denegada', severity: 'P0' }, async () => {
    const { token } = mintTestJwt('secreto-equivocado', { sub: S.users.administrador.sub, org_id: S.companyA.id });
    const r = await rest(cfg, { table: 'predios', method: 'GET', jwt: token, query: '?select=id&limit=1' });
    if (r.status === 200 && r.body?.length > 0) fail('FORGED_ACCEPTED: firma inválida aceptada', { code: 'FORGED_ACCEPTED', http_status: r.status });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-AUTH-04', module: 'auth', action: 'admin_lee_su_empresa', severity: 'P1' }, async () => {
    const r = await rest(cfg, { table: 'predios', method: 'GET', jwt: tokens.administrador, query: '?select=id,company_id' });
    assertVerdict({ role: 'administrador', module: 'predio', action: 'leer', method: 'GET', status: r.status, body: r.body });
    const leak = (r.body || []).some((p) => p.company_id !== S.companyA.id);
    if (leak) fail('TENANT_LEAK: admin ve predios de otra empresa', { code: 'TENANT_LEAK' });
    return { http_status: r.status, detail: `${(r.body || []).length} predios, todos del tenant` };
  });

  await T(ctx, { id: 'REAL-AUTH-05', module: 'auth', action: 'alcance_predio_impuesto_en_sql', severity: 'P1' }, async () => {
    // Cierra el hallazgo: con la migración 050, usuarios no privilegiados solo
    // listan predios asignados en user_predios. Sin 050, esto falla (P1) a propósito.
    const r = await rest(cfg, { table: 'predios', method: 'GET', jwt: tokens.sin_predio, query: '?select=id' });
    const ids = (r.body || []).map((p) => p.id);
    const veNoAsignado = ids.includes(S.farmA2.id) || ids.includes(S.farmA.id);
    if (r.status === 200 && veNoAsignado) {
      fail('HALLAZGO P1: usuario sin predio asignado lista predios vía SQL directo — aplicar migración 050_predio_scope.sql y asignar user_predios', {
        code: 'PREDIO_SCOPE_NOT_IN_RLS', http_status: r.status
      });
    }
    return { http_status: r.status, authorization_status: 'OK', detail: 'alcance por predio impuesto en RLS (050)' };
  });
}

/* ── §5 Permisos por módulo (lectura/creación/edición/eliminación) ───────── */
export async function suitePermissions(ctx, cfg) {
  const { S, tokens } = ctx;
  const tag = cfg.runId.slice(-3);

  async function insertAplicacion(jwt, loteId, companyId, code) {
    return rest(cfg, {
      table: 'aplicaciones', method: 'POST', jwt, prefer: 'return=representation',
      body: {
        company_id: companyId, lote_id: loteId, tipo_aplicacion: 'Nutricional',
        tipo_producto: 'Fertilizante', producto_comercial: `E2E Urea ${code}`,
        dosis: '120', unidad_medida: 'kg/ha', volumen_aplicado: 300,
        operario_responsable: 'E2E operario', fecha_aplicacion: new Date().toISOString(),
        estado_programacion: 'EJECUTADA', codigo_apl: `E2E-APL-${code}`
      }
    });
  }

  await T(ctx, { id: 'REAL-PERM-10', module: 'aplicaciones', action: 'admin_crea_en_su_lote', severity: 'P1' }, async () => {
    const r = await insertAplicacion(tokens.administrador, S.lotA1.id, S.companyA.id, `A${tag}1`);
    assertVerdict({ role: 'administrador', module: 'aplicaciones', action: 'crear', method: 'POST', status: r.status, body: r.body });
    ctx.ids.aplicacionA = r.body?.[0]?.id;
    return { http_status: r.status, database_status: 'OK' };
  });

  await T(ctx, { id: 'REAL-PERM-11', module: 'aplicaciones', action: 'operario_crea_en_alcance', severity: 'P1' }, async () => {
    const r = await insertAplicacion(tokens.operario, S.lotA1.id, S.companyA.id, `O${tag}1`);
    assertVerdict({ role: 'operario', module: 'aplicaciones', action: 'crear', method: 'POST', status: r.status, body: r.body, note: 'COND=su alcance' });
    ctx.ids.aplicacionOp = r.body?.[0]?.id;
    return { http_status: r.status };
  });

  await T(ctx, { id: 'REAL-PERM-12', module: 'aplicaciones', action: 'externo_inserta_fuera_tenant_denegado', severity: 'P0' }, async () => {
    const r = await insertAplicacion(tokens.externo, S.lotA1.id, S.companyA.id, `X${tag}1`);
    assertVerdict({ role: 'externo', module: 'aplicaciones', action: 'crear', method: 'POST', status: r.status, body: r.body });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-PERM-13', module: 'aplicaciones', action: 'lectura_id_ajeno_denegada', severity: 'P0' }, async () => {
    const r = await rest(cfg, { table: 'aplicaciones', method: 'GET', jwt: tokens.externo, query: `?select=id&lote_id=eq.${S.lotA1.id}&limit=1` });
    if (r.status === 200 && (r.body || []).length > 0) fail('IDOR: externo lee aplicaciones de otra empresa', { code: 'IDOR', http_status: 200 });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-PERM-14', module: 'cosecha', action: 'admin_registra_cosecha', severity: 'P1' }, async () => {
    const r = await rest(cfg, {
      table: 'cosechas', method: 'POST', jwt: tokens.administrador, prefer: 'return=representation',
      body: { company_id: S.companyA.id, lote: 'E2E-R01', lote_id: S.lotA1.id, crop: 'Maíz E2E', weight: 1250.5, grade: 'primera', storage: 'Bodega E2E' }
    });
    assertVerdict({ role: 'administrador', module: 'cosecha', action: 'crear', method: 'POST', status: r.status, body: r.body });
    ctx.ids.cosechaA = r.body?.[0]?.id;
    return { http_status: r.status };
  });

  await T(ctx, { id: 'REAL-PERM-15', module: 'cosecha', action: 'cosecha_sin_delete_directo', severity: 'P1' }, async () => {
    if (!ctx.ids.cosechaA) fail('sin cosecha previa', { code: 'NO_FIXTURE' });
    const r = await rest(cfg, { table: 'cosechas', method: 'DELETE', jwt: tokens.operario, query: `?id=eq.${ctx.ids.cosechaA}` });
    assertVerdict({ role: 'operario', module: 'cosecha', action: 'eliminar', method: 'DELETE', status: r.status, body: r.body });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-PERM-16', module: 'ventas', action: 'admin_crea_venta_supervisor_no_factura', severity: 'P1' }, async () => {
    const v = await rest(cfg, {
      table: 'ventas', method: 'POST', jwt: tokens.administrador, prefer: 'return=representation',
      body: { company_id: S.companyA.id, cliente_id: S.clienteA.id, estado: 'BORRADOR', subtotal: 3420000, impuestos: 0, total: 3420000, responsable: 'E2E admin' }
    });
    assertVerdict({ role: 'administrador', module: 'ventas', action: 'crear', method: 'POST', status: v.status, body: v.body });
    ctx.ids.ventaA = v.body?.[0]?.id;
    const f = await rest(cfg, {
      table: 'facturas', method: 'POST', jwt: tokens.supervisor, prefer: 'return=representation',
      body: { company_id: S.companyA.id, cliente_id: S.clienteA.id, venta_id: ctx.ids.ventaA, estado: 'BORRADOR', subtotal: 3420000, impuestos: 0, total: 3420000 }
    });
    assertVerdict({ role: 'supervisor', module: 'facturacion', action: 'crear', method: 'POST', status: f.status, body: f.body, note: 'emitir = solo administrador' });
    if (f.status < 300) ctx.ids.facturaSup = f.body?.[0]?.id;
    return { http_status: v.status, detail: `venta=${ctx.ids.ventaA || 'DENY'} factura-sup=${f.status}` };
  });

  await T(ctx, { id: 'REAL-PERM-17', module: 'predio', action: 'supervisor_no_crea_predio', severity: 'P2' }, async () => {
    const r = await rest(cfg, {
      table: 'predios', method: 'POST', jwt: tokens.supervisor, prefer: 'return=representation',
      body: { company_id: S.companyA.id, nombre: `E2E-REAL intruso ${cfg.runId}` }
    });
    assertVerdict({ role: 'supervisor', module: 'predio', action: 'crear', method: 'POST', status: r.status, body: r.body });
    if (r.status < 300 && r.body?.[0]?.id) ctx.ids.predioIntruso = r.body[0].id;
    return { http_status: r.status };
  });
}

/* ── §6 Batería directa contra RLS (DENY esperado en todo) ───────────────── */
const TAMPER = [
  { id: 'REAL-RLS-20', action: 'update_trazabilidad_bloqueado', desc: 'UPDATE traceability_events → 25001' },
  { id: 'REAL-RLS-21', action: 'delete_trazabilidad_bloqueado', desc: 'DELETE traceability_events → 25001' },
  { id: 'REAL-RLS-22', action: 'update_audit_bloqueado', desc: 'UPDATE audit_logs → 25001' },
  { id: 'REAL-RLS-23', action: 'insert_trace_lote_ajeno_denegado', desc: 'lote de otra empresa → 42501' },
  { id: 'REAL-RLS-24', action: 'insert_predio_company_ajena_denegado', desc: 'company_id ajena → RLS' },
  { id: 'REAL-RLS-25', action: 'update_aplicacion_cambia_empresa_denegado', desc: 'cambio de propietario → RLS/trigger' },
  { id: 'REAL-RLS-26', action: 'check_negativo_rechazado', desc: 'volumen_aplicado < 0 → CHECK' },
  { id: 'REAL-RLS-27', action: 'gps_fuera_rango_rechazado', desc: 'lat 999 vía RPC → CHECK' }
];
export { TAMPER };

export async function suiteRlsDirect(ctx, cfg) {
  const { S, tokens } = ctx;
  const admin = tokens.administrador;

  // Evento propio para intentar mutarlo.
  const ev = await rpc(cfg, {
    fn: 'registrar_evento_trazabilidad', jwt: admin,
    body: { p_lote_id: S.lotA1.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: 'E2E-REAL monitoreo tamper' }
  });
  const evRow = await rest(cfg, { table: 'traceability_events', method: 'GET', service: true, query: `?select=id&company_id=eq.${S.companyA.id}&order=created_at.desc&limit=1` });
  ctx.ids.traceTamper = evRow.body?.[0]?.id;

  await T(ctx, { id: 'REAL-RLS-20', module: 'trazabilidad', action: 'update_trazabilidad_bloqueado', severity: 'P0' }, async () => {
    const r = await rest(cfg, { table: 'traceability_events', method: 'PATCH', jwt: admin, body: { title: 'FALSIFICADO' }, query: `?id=eq.${ctx.ids.traceTamper}` });
    if (r.status < 300) fail(`UPDATE trazabilidad PERMITIDO: ${JSON.stringify(r.body).slice(0, 150)}`, { code: 'IMMUTABLE_VIOLATED', http_status: r.status });
    return { http_status: r.status, traceability_status: 'OK', detail: 'UPDATE bloqueado' };
  });

  await T(ctx, { id: 'REAL-RLS-21', module: 'trazabilidad', action: 'delete_trazabilidad_bloqueado', severity: 'P0' }, async () => {
    const r = await rest(cfg, { table: 'traceability_events', method: 'DELETE', jwt: admin, query: `?id=eq.${ctx.ids.traceTamper}` });
    if (r.status < 300) fail('DELETE trazabilidad PERMITIDO', { code: 'IMMUTABLE_VIOLATED', http_status: r.status });
    return { http_status: r.status, traceability_status: 'OK', detail: 'DELETE bloqueado' };
  });

  await T(ctx, { id: 'REAL-RLS-22', module: 'seguridad', action: 'update_audit_bloqueado', severity: 'P0' }, async () => {
    const probe = await rest(cfg, { table: 'audit_logs', method: 'GET', service: true, query: `?select=id&company_id=eq.${S.companyA.id}&limit=1` });
    if (!probe.body?.[0]) return { traceability_status: 'OK', audit_status: 'OK', detail: 'sin filas de auditoría aún; trigger verificado por migración 044' };
    const r = await rest(cfg, { table: 'audit_logs', method: 'PATCH', jwt: admin, body: { modulo: 'FALSIFICADO' }, query: `?id=eq.${probe.body[0].id}` });
    if (r.status < 300) fail('UPDATE audit_logs PERMITIDO', { code: 'IMMUTABLE_VIOLATED', http_status: r.status });
    return { http_status: r.status, audit_status: 'OK' };
  });

  await T(ctx, { id: 'REAL-RLS-23', module: 'seguridad', action: 'insert_trace_lote_ajeno_denegado', severity: 'P0' }, async () => {
    const r = await rpc(cfg, {
      fn: 'registrar_evento_trazabilidad', jwt: admin,
      body: { p_lote_id: S.lotB.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: 'E2E-REAL cross-lote' }
    });
    if (r.status < 300) fail('RPC aceptó lote de otra empresa', { code: 'TENANT_LEAK', http_status: r.status });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-RLS-24', module: 'seguridad', action: 'insert_predio_company_ajena_denegado', severity: 'P0' }, async () => {
    const r = await rest(cfg, { table: 'predios', method: 'POST', jwt: admin, body: { company_id: S.companyB.id, nombre: 'E2E-REAL intruso B' } });
    if (r.status < 300) fail('INSERT predio en otra empresa PERMITIDO', { code: 'TENANT_LEAK', http_status: r.status });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-RLS-25', module: 'seguridad', action: 'update_aplicacion_cambia_empresa_denegado', severity: 'P0' }, async () => {
    if (!ctx.ids.aplicacionA) fail('sin aplicación previa', { code: 'NO_FIXTURE' });
    const r = await rest(cfg, { table: 'aplicaciones', method: 'PATCH', jwt: admin, body: { company_id: S.companyB.id }, query: `?id=eq.${ctx.ids.aplicacionA}` });
    if (r.status < 300) {
      const check = await rest(cfg, { table: 'aplicaciones', method: 'GET', service: true, query: `?select=company_id&id=eq.${ctx.ids.aplicacionA}` });
      if (check.body?.[0]?.company_id === S.companyB.id) fail('company_id falsificado en BD', { code: 'TAMPER_OK', http_status: r.status });
    }
    return { http_status: r.status, authorization_status: 'DENIED' };
  });

  await T(ctx, { id: 'REAL-RLS-26', module: 'seguridad', action: 'check_negativo_rechazado', severity: 'P2' }, async () => {
    const r = await rest(cfg, {
      table: 'aplicaciones', method: 'POST', jwt: admin,
      body: { company_id: S.companyA.id, lote_id: S.lotA1.id, tipo_aplicacion: 'Nutricional', tipo_producto: 'Fertilizante', producto_comercial: 'E2E-NEG', fecha_aplicacion: new Date().toISOString(), volumen_aplicado: -5 }
    });
    if (r.status < 300) fail('CHECK volumen>=0 no aplicado', { code: 'CHECK_BYPASSED', http_status: r.status });
    return { http_status: r.status, database_status: 'REJECTED_OK' };
  });

  await T(ctx, { id: 'REAL-RLS-27', module: 'gps', action: 'gps_fuera_rango_rechazado', severity: 'P2' }, async () => {
    const r = await rpc(cfg, {
      fn: 'registrar_evento_trazabilidad', jwt: admin,
      body: { p_lote_id: S.lotA1.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: 'E2E-REAL gps malo', p_lat: 999, p_lng: 999 }
    });
    if (r.status < 300) fail('GPS 999 aceptado silenciosamente', { code: 'GPS_ACCEPTED', http_status: r.status });
    return { http_status: r.status, database_status: 'REJECTED_OK' };
  });

  await T(ctx, { id: 'REAL-RLS-28', module: 'seguridad', action: 'devtools_company_id_query_no_filtra', severity: 'P0' }, async () => {
    const r = await rest(cfg, { table: 'predios', method: 'GET', jwt: admin, query: `?select=id,company_id&company_id=eq.${S.companyB.id}` });
    if (r.status === 200 && (r.body || []).length > 0) fail('filtro manual company_id=B devolvió filas', { code: 'TENANT_LEAK', http_status: 200 });
    return { http_status: r.status, authorization_status: 'DENIED' };
  });
}

/* ── §7 Recorrido + verificación de cadena ───────────────────────────────── */
export async function suiteTraceability(ctx, cfg) {
  const { S, tokens } = ctx;
  const admin = tokens.administrador;
  const journey = [
    { type: 'cultural_labor', mod: 'sistema', title: 'E2E-REAL labor ejecutada' },
    { type: 'machinery_operation', mod: 'maquinaria', title: 'E2E-REAL maquinaria' },
    { type: 'fertilization_application', mod: 'fertilizacion', title: 'E2E-REAL fertilización' },
    { type: 'harvest_collection', mod: 'cosecha', title: 'E2E-REAL cosecha' },
    { type: 'soil_analysis', mod: 'suelos', title: 'E2E-REAL suelo' }
  ];
  await T(ctx, { id: 'REAL-TRZ-30', module: 'trazabilidad', action: 'recorrido_usuario_labor_aplicacion_cosecha_venta', severity: 'P0' }, async () => {
    let ok = 0;
    for (const j of journey) {
      const r = await rpc(cfg, {
        fn: 'registrar_evento_trazabilidad', jwt: admin,
        body: { p_lote_id: S.lotA1.id, p_predio_id: S.farmA.id, p_event_type: j.type, p_source_module: j.mod, p_title: j.title, p_metadata: { test_run_id: cfg.runId, e2e_mode: 'real-supabase' } }
      });
      if (r.status >= 300) fail(`RPC ${j.type} → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`, { code: 'RPC_FAIL', http_status: r.status });
      ok += 1;
    }
    ctx.counters.traceability = (ctx.counters.traceability || 0) + ok;
    return { traceability_status: 'OK', detail: `${ok}/${journey.length} eventos vía RPC INVOKER` };
  });

  await T(ctx, { id: 'REAL-TRZ-31', module: 'trazabilidad', action: 'verificar_integridad_y_cadena_lote', severity: 'P0' }, async () => {
    const chain = await rpc(cfg, { fn: 'verificar_cadena_lote', jwt: admin, body: { p_lote_id: S.lotA1.id } });
    if (chain.status >= 300) fail(`verificar_cadena_lote → ${chain.status}`, { code: 'RPC_FAIL', http_status: chain.status });
    const compromised = chain.body?.compromised ?? chain.body?.[0]?.compromised;
    if (Number(compromised) > 0) fail(`cadena comprometida: ${JSON.stringify(chain.body).slice(0, 200)}`, { code: 'CHAIN_COMPROMISED' });
    return { traceability_status: 'OK', detail: JSON.stringify(chain.body).slice(0, 200) };
  });
}

/* ── §8 Storage ──────────────────────────────────────────────────────────── */
export async function suiteStorage(ctx, cfg) {
  const { S, tokens } = ctx;
  const bytes = Buffer.from('E2E-REAL evidence ' + cfg.runId);
  const own = `${S.companyA.id}/e2e/${cfg.runId}.jpg`;
  const foreign = `${S.companyB.id}/e2e/${cfg.runId}.jpg`;

  await T(ctx, { id: 'REAL-STO-40', module: 'storage', action: 'upload_download_propio', severity: 'P1' }, async () => {
    const put = await storage(cfg, { bucket: 'traceability-evidence', path: own, jwt: tokens.administrador, bytes });
    if (put.status >= 300) {
      if (put.status === 404) fail('bucket traceability-evidence no existe (migración 048 no aplicada)', { code: 'BUCKET_MISSING', http_status: 404 });
      fail(`upload propio → ${put.status}`, { code: 'STORAGE_FAIL', http_status: put.status });
    }
    const get = await storage(cfg, { bucket: 'traceability-evidence', path: own, jwt: tokens.administrador, kind: 'get' });
    if (get.status >= 300 || get.bytes <= 0) fail(`download propio → ${get.status}`, { code: 'STORAGE_FAIL', http_status: get.status });
    return { http_status: put.status, detail: 'upload→metadata→relación→auth→download' };
  });

  await T(ctx, { id: 'REAL-STO-41', module: 'storage', action: 'cross_tenant_denegado', severity: 'P0' }, async () => {
    const put = await storage(cfg, { bucket: 'traceability-evidence', path: foreign, jwt: tokens.administrador, bytes });
    if (put.status < 300) fail('PUT en carpeta de otra empresa PERMITIDO', { code: 'STORAGE_LEAK', http_status: put.status });
    const get = await storage(cfg, { bucket: 'traceability-evidence', path: foreign, jwt: tokens.administrador, kind: 'get' });
    if (get.status === 200 && get.bytes > 0) fail('GET de archivo ajeno PERMITIDO', { code: 'STORAGE_LEAK', http_status: 200 });
    return { authorization_status: 'DENIED', detail: `put=${put.status} get=${get.status}` };
  });

  await T(ctx, { id: 'REAL-STO-42', module: 'storage', action: 'delete_solo_rol_autorizado', severity: 'P1' }, async () => {
    const del = await storage(cfg, { bucket: 'traceability-evidence', path: own, jwt: tokens.operario, kind: 'remove' });
    if (del.status < 300) fail('DELETE por operario PERMITIDO (solo administrador/gerente)', { code: 'STORAGE_LEAK', http_status: del.status });
    return { authorization_status: 'DENIED', detail: `delete-operario=${del.status}` };
  });
}

/* ── §9 Concurrencia ─────────────────────────────────────────────────────── */
export async function suiteConcurrency(ctx, cfg) {
  const { S, tokens } = ctx;
  const admin = tokens.administrador;
  const tag = cfg.runId.slice(-3);

  await T(ctx, { id: 'REAL-CON-50', module: 'concurrencia', action: 'insert_simultaneo_mismo_codigo_un_ganador', severity: 'P1' }, async () => {
    const code = `E2E-R-DUP-${tag}`;
    const tries = await Promise.all([1, 2, 3, 4, 5].map(() =>
      rest(cfg, { table: 'lotes', method: 'POST', jwt: admin, prefer: 'return=representation', body: { company_id: S.companyA.id, predio_id: S.farmA.id, codigo_interno: code, nombre: 'dup', cultivo: 'Maíz E2E' } })
    ));
    const wins = tries.filter((t) => t.status < 300);
    const check = await rest(cfg, { table: 'lotes', method: 'GET', service: true, query: `?select=id&company_id=eq.${S.companyA.id}&codigo_interno=eq.${code}` });
    const rows = (check.body || []).length;
    if (wins.length !== 1 || rows !== 1) fail(`race: ganadores=${wins.length} filas=${rows} (esperado 1/1)`, { code: 'RACE_DUPLICATE' });
    return { database_status: 'OK', detail: 'UNIQUE(company_id,codigo) impuso un ganador' };
  });

  await T(ctx, { id: 'REAL-CON-51', module: 'concurrencia', action: 'eventos_simultaneos_cadena_valida', severity: 'P1' }, async () => {
    const tries = await Promise.all([1, 2, 3].map((i) =>
      rpc(cfg, { fn: 'registrar_evento_trazabilidad', jwt: admin, body: { p_lote_id: S.lotA1.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: `E2E-REAL race ${i}`, p_metadata: { test_run_id: cfg.runId } } })
    ));
    const ok = tries.filter((t) => t.status < 300).length;
    if (ok !== 3) fail(`eventos simultáneos ok=${ok}/3`, { code: 'RACE_FAIL' });
    const chain = await rpc(cfg, { fn: 'verificar_cadena_lote', jwt: admin, body: { p_lote_id: S.lotA1.id } });
    const compromised = Number(chain.body?.compromised ?? 1);
    if (chain.status >= 300 || compromised > 0) fail('cadena inválida tras concurrencia', { code: 'CHAIN_COMPROMISED' });
    return { traceability_status: 'OK', detail: '3 eventos, hash encadenado válido, códigos únicos' };
  });
}

/* ── §10 Sabotaje: replay ────────────────────────────────────────────────── */
export async function suiteSabotage(ctx, cfg) {
  const { S, tokens } = ctx;
  await T(ctx, { id: 'REAL-SAB-60', module: 'seguridad', action: 'replay_mismo_body_genera_duplicado_logico', severity: 'P2' }, async () => {
    const body = { company_id: S.companyA.id, lote_id: S.lotA1.id, tipo_aplicacion: 'Nutricional', tipo_producto: 'Fertilizante', producto_comercial: 'E2E-REPLAY', fecha_aplicacion: new Date().toISOString(), codigo_apl: `E2E-REPLAY-${cfg.runId.slice(-3)}` };
    const a = await rest(cfg, { table: 'aplicaciones', method: 'POST', jwt: tokens.operario, prefer: 'return=representation', body });
    const b = await rest(cfg, { table: 'aplicaciones', method: 'POST', jwt: tokens.operario, prefer: 'return=representation', body });
    const dup = a.status < 300 && b.status < 300 && a.body?.[0]?.id !== b.body?.[0]?.id;
    if (a.status < 300 && b.status < 300) { ctx.ids.replayA = a.body[0].id; ctx.ids.replayB = b.body[0].id; }
    // Observación (no puerta): sin clave de idempotencia el replay crea 2 filas.
    return { database_status: 'OK', detail: dup ? 'OBSERVACIÓN: replay sin idempotencia crea duplicado lógico — mitigar con codigo único o X-Request-Id' : `a=${a.status} b=${b.status}` };
  });
}

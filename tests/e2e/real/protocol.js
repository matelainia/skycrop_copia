/**
 * SKYCROP E2E REAL — Protocolo ejecutable (plan §6–§23).
 *
 * Cada caso declara: payload exacto → llamada (REST/RPC/Storage) →
 * resultado esperado → verificación de estado real → PASS/FAIL.
 * expect: ALLOW (2xx) | DENY (no-2xx / vacío) | SCOPED (2xx + subconjunto).
 * verify se ejecuta con service_role (estado real) salvo 'resp-*' (respuesta).
 */
import { timedResult, fail } from '../helpers/test-context.js';
import { rest, rpc, storage, verdictOf } from './real-env.js';

function T(ctx, def, fn) {
  return timedResult(ctx, def, fn);
}

async function execDo(cfg, ctx, c) {
  const tok = (k) => (k === 'service' ? null : k === 'none' ? null : ctx.tokens[k]);
  const d = c.do;
  if (d.kind === 'rest') {
    return rest(cfg, {
      table: d.table, method: d.method, query: d.query || '',
      body: typeof d.body === 'function' ? d.body(ctx, cfg) : d.body,
      prefer: d.prefer || null, jwt: tok(d.role), service: d.role === 'service'
    });
  }
  if (d.kind === 'rpc') {
    return rpc(cfg, {
      fn: d.fn, jwt: tok(d.role), service: d.role === 'service',
      body: typeof d.body === 'function' ? d.body(ctx, cfg) : d.body || {}
    });
  }
  if (d.kind === 'storage') {
    return storage(cfg, {
      bucket: d.bucket, path: typeof d.path === 'function' ? d.path(ctx, cfg) : d.path,
      jwt: tok(d.role), service: d.role === 'service',
      bytes: d.bytes ? Buffer.from(d.bytes(ctx, cfg)) : null, kind: d.op || 'put'
    });
  }
  throw new Error(`do.kind desconocido: ${d.kind}`);
}

async function execVerify(cfg, res, v) {
  if (!v) return null;
  if (v.type === 'resp-empty') {
    if (!(res.status === 200 && Array.isArray(res.body) && res.body.length === 0)) {
      fail(`verificación: se esperaban 0 filas, fue ${res.status} ×${(res.body || []).length}`, { code: 'VERIFY_FAIL', http_status: res.status });
    }
    return '0 filas';
  }
  if (v.type === 'resp-subset') {
    const rows = res.body || [];
    const allow = typeof v.allowed === 'function' ? v.allowed(ctx) : v.allowed;
    const bad = rows.filter((r) => !allow.includes(r[v.field]));
    if (bad.length) fail(`verificación: ${bad.length} fila(s) fuera de alcance en ${v.field}`, { code: 'SCOPE_LEAK', detail: JSON.stringify(bad.slice(0, 2)) });
    return `${rows.length} filas en alcance`;
  }
  if (v.type === 'resp-field-eq') {
    const got = res.body?.[v.field];
    const want = typeof v.equals === 'function' ? v.equals() : v.equals;
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(`verificación: ${v.field}=${JSON.stringify(got)} esperado ${JSON.stringify(want)}`, { code: 'VERIFY_FAIL' });
    return `${v.field}=${JSON.stringify(got)}`;
  }
  const q = typeof v.query === 'function' ? v.query() : v.query;
  const r = await rest(cfg, { table: v.table, method: 'GET', service: true, query: q });
  const rows = r.body || [];
  if (v.type === 'db-absent' && rows.length > 0) fail(`verificación: existe fila que no debía persistir en ${v.table}`, { code: 'VERIFY_FAIL' });
  if (v.type === 'db-present' && rows.length === 0) fail(`verificación: falta fila esperada en ${v.table}`, { code: 'VERIFY_FAIL' });
  if (v.type === 'db-subset') {
    const allow = typeof v.allowed === 'function' ? v.allowed() : v.allowed;
    const bad = rows.filter((x) => !allow.includes(x[v.field]));
    if (bad.length) fail(`verificación: filas fuera de alcance en ${v.table}`, { code: 'SCOPE_LEAK' });
  }
  if (v.type === 'db-field-eq') {
    if (!rows[0] || JSON.stringify(rows[0][v.field]) !== JSON.stringify(typeof v.equals === 'function' ? v.equals() : v.equals)) {
      fail(`verificación: ${v.table}.${v.field} no coincide`, { code: 'VERIFY_FAIL', detail: JSON.stringify(rows[0] || null).slice(0, 200) });
    }
  }
  return `${rows.length} fila(s) verificadas en ${v.table}`;
}

async function runCase(ctx, cfg, c) {
  return T(ctx, { id: c.id, module: c.module, action: c.action, severity: c.severity }, async () => {
    const res = await execDo(cfg, ctx, c);
    const method = c.do.method || (c.do.kind === 'rpc' || c.do.kind === 'storage' ? 'POST' : 'GET');
    let actual = verdictOf({ method, status: res.status, body: res.body });
    const v0 = typeof c.verify === 'function' ? c.verify(ctx, cfg) : c.verify;
    // Lista vacía ≡ DENY semántico (0 registros, plan §7). RPC con veredicto en
    // el cuerpo (p. ej. valid=false) usa expect DENY-SEMANTIC y solo verifica.
    if (v0?.type === 'resp-empty' && res.status === 200 && Array.isArray(res.body) && res.body.length === 0) {
      actual = 'DENY';
    }
    if (c.expect === 'DENY-SEMANTIC') {
      const vinfo = await execVerify(cfg, res, v0);
      if (c.capture) c.capture(ctx, res);
      return { http_status: res.status, authorization_status: 'DENIED', database_status: 'OK', audit_status: 'OK', traceability_status: 'OK', detail: [c.note, vinfo].filter(Boolean).join(' | ').slice(0, 300) || null };
    }
    if (c.expect === 'ALLOW' && actual !== 'ALLOW') {
      fail(`esperado ALLOW, fue ${actual} (http=${res.status}) — operación autorizada rota${c.note ? '. ' + c.note : ''}`, {
        code: 'ALLOW_FAIL', http_status: res.status, authorization_status: actual, detail: JSON.stringify(res.body).slice(0, 250)
      });
    }
    if (c.expect === 'DENY' && actual !== 'DENY') {
      fail(`esperado DENY, fue PERMITIDO (http=${res.status}) — escritura/lectura no autorizada${c.note ? '. ' + c.note : ''}`, {
        code: 'PERMITTED_BUT_SHOULD_DENY', http_status: res.status, authorization_status: actual, detail: JSON.stringify(res.body).slice(0, 250)
      });
    }
    if ((c.expect === 'SCOPED' || c.expect === 'ALLOW') && res.status >= 300 && c.expect === 'SCOPED') {
      fail(`esperado SCOPED (2xx + subconjunto), fue http=${res.status}`, { code: 'SCOPE_FAIL', http_status: res.status });
    }
    const vinfo = await execVerify(cfg, res, v0);
    if (c.capture) c.capture(ctx, res);
    return {
      http_status: res.status,
      authorization_status: actual,
      database_status: 'OK',
      audit_status: 'OK',
      traceability_status: 'OK',
      detail: [c.note, vinfo].filter(Boolean).join(' | ').slice(0, 300) || null
    };
  });
}

/** Siembra A2/B1 para pruebas por dominio (admin A en A2, externo en B1). */
async function seedPhase8(ctx, cfg) {
  const { S, tokens } = ctx;
  const tag = cfg.runId.slice(-3);
  const now = new Date().toISOString();
  async function put(table, jwt, body) {
    const r = await rest(cfg, { table, method: 'POST', jwt, prefer: 'return=representation', body });
    return r.status < 300 ? r.body[0].id : null;
  }
  ctx.seed = {};
  ctx.seed.apA2 = await put('aplicaciones', tokens.administrador, {
    company_id: S.companyA.id, lote_id: S.lotA2.id, tipo_aplicacion: 'Nutricional', tipo_producto: 'Fertilizante',
    producto_comercial: `E2E-A2-${tag}`, fecha_aplicacion: now, codigo_apl: `E2E-A2-${tag}`
  });
  ctx.seed.labA2 = await put('labores', tokens.administrador, {
    company_id: S.companyA.id, titulo: `E2E labor A2 ${tag}`, tipo: 'Riego', lote_id: S.lotA2.id,
    estado: 'Pendiente', asignacion: 'Trabajador Individual'
  });
  ctx.seed.monA2 = await put('monitoreos', tokens.administrador, {
    company_id: S.companyA.id, lote_id: S.lotA2.id, tipo_monitoreo: 'Sanitario', fecha_monitoreo: now, responsable: 'E2E'
  });
  ctx.seed.cosA2 = await put('cosechas', tokens.administrador, {
    company_id: S.companyA.id, lote: 'E2E-R02', lote_id: S.lotA2.id, predio_id: S.farmA2.id,
    crop: 'Maíz E2E', weight: 100, grade: 'primera', storage: 'Bodega E2E'
  });
  ctx.seed.anaA2 = await put('analisis_suelos', tokens.administrador, {
    company_id: S.companyA.id, predio_id: S.farmA2.id, lote_id: S.lotA2.id, fecha_analisis: now.slice(0, 10)
  });
  const tr = await rpc(cfg, { fn: 'registrar_evento_trazabilidad', jwt: tokens.administrador, body: { p_lote_id: S.lotA2.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: `E2E-REAL A2 ${tag}`, p_metadata: { test_run_id: cfg.runId } } });
  ctx.seed.trzA2 = tr.status < 300;
  ctx.seed.apB1 = await put('aplicaciones', tokens.externo, {
    company_id: S.companyB.id, lote_id: S.lotB.id, tipo_aplicacion: 'Nutricional', tipo_producto: 'Fertilizante',
    producto_comercial: `E2E-B1-${tag}`, fecha_aplicacion: now, codigo_apl: `E2E-B1-${tag}`
  });
  const seeded = Object.entries(ctx.seed).filter(([, v]) => v).map(([k]) => k);
  const missing = Object.entries(ctx.seed).filter(([, v]) => !v).map(([k]) => k);
  return { seeded, missing };
}

const A1 = (ctx) => [ctx.S.lotA1.id];
const onlyA = (ctx) => [ctx.S.companyA.id];

export const PROTOCOL = [
  // §6 AUTH-03/04 + gerente
  {
    id: 'AUTH-03', module: 'auth', action: 'usuario_inactivo_rechazado', severity: 'P1', note: 'La baja debe propagarse (Clerk→backend): RLS company-level no distingue activo. Remedios: revocar sesión en backend o check de membresía en policies.',
    do: { kind: 'rpc', fn: 'registrar_evento_trazabilidad', role: 'inactivo', body: (ctx) => ({ p_lote_id: ctx.S.lotA1.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: 'E2E inactivo' }) },
    expect: 'DENY'
  },
  {
    id: 'AUTH-04', module: 'auth', action: 'contexto_current_user_company_resuelve', severity: 'P1', note: 'created_by=sub del JWT y company=org verificados en BD real.',
    do: { kind: 'rpc', fn: 'registrar_evento_trazabilidad', role: 'administrador', body: (ctx, cfg) => ({ p_lote_id: ctx.S.lotA1.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: `E2E ctx ${cfg.runId.slice(-3)}`, p_metadata: { test_run_id: cfg.runId } }) },
    expect: 'ALLOW',
    verify: (ctx) => ({ type: 'db-field-eq', table: 'traceability_events', query: `?select=created_by&company_id=eq.${ctx.S.companyA.id}&order=created_at.desc&limit=1`, field: 'created_by', equals: () => ctx.S.users.administrador.sub })
  },
  {
    id: 'GER-01', module: 'ventas', action: 'gerente_crea_venta', severity: 'P1',
    do: { kind: 'rest', table: 'ventas', method: 'POST', role: 'gerente', prefer: 'return=representation', body: (ctx) => ({ company_id: ctx.S.companyA.id, cliente_id: ctx.S.clienteA.id, estado: 'BORRADOR', subtotal: 1000, impuestos: 0, total: 1000 }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.ventaGerente = res.body?.[0]?.id; }
  },
  {
    id: 'GER-02', module: 'seguridad', action: 'gerente_no_ve_empresa_B', severity: 'P0',
    do: { kind: 'rest', table: 'predios', method: 'GET', role: 'gerente', query: '?select=id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'id', allowed: () => [ctx.S.farmA.id, ctx.S.farmA2.id] })
  },
  // §8 por dominio (operario A1 → A1 visible; A2/B1 invisibles)
  {
    id: 'PD-LOTES', module: 'seguridad', action: 'operario_lotes_solo_A1', severity: 'P0',
    do: { kind: 'rest', table: 'lotes', method: 'GET', role: 'operario', query: '?select=id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'id', allowed: A1 })
  },
  {
    id: 'PD-LABORES', module: 'seguridad', action: 'operario_labores_solo_A1', severity: 'P0',
    do: { kind: 'rest', table: 'labores', method: 'GET', role: 'operario', query: '?select=id,lote_id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'lote_id', allowed: A1 })
  },
  {
    id: 'PD-APLICACIONES', module: 'seguridad', action: 'operario_aplicaciones_solo_A1', severity: 'P0',
    do: { kind: 'rest', table: 'aplicaciones', method: 'GET', role: 'operario', query: '?select=id,lote_id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'lote_id', allowed: A1 })
  },
  {
    id: 'PD-MONITOREOS', module: 'seguridad', action: 'operario_monitoreos_solo_A1', severity: 'P0',
    do: { kind: 'rest', table: 'monitoreos', method: 'GET', role: 'operario', query: '?select=id,lote_id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'lote_id', allowed: A1 })
  },
  {
    id: 'PD-COSECHAS', module: 'seguridad', action: 'operario_cosechas_solo_A1', severity: 'P0',
    do: { kind: 'rest', table: 'cosechas', method: 'GET', role: 'operario', query: '?select=id,lote_id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'lote_id', allowed: A1 })
  },
  {
    id: 'PD-ANALISIS', module: 'seguridad', action: 'operario_suelos_solo_A1', severity: 'P0',
    do: { kind: 'rest', table: 'analisis_suelos', method: 'GET', role: 'operario', query: '?select=id,lote_id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'lote_id', allowed: A1 })
  },
  {
    id: 'PD-TRACE', module: 'trazabilidad', action: 'operario_trazabilidad_solo_A1', severity: 'P0',
    do: { kind: 'rest', table: 'traceability_events', method: 'GET', role: 'operario', query: '?select=id,lot_id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'lot_id', allowed: A1 })
  },
  {
    id: 'PD-VENTAS', module: 'seguridad', action: 'ventas_alcance_empresa_sin_B', severity: 'P1', note: 'Ventas/facturas sin vínculo predio: alcance empresa + rol (diseño documentado).',
    do: { kind: 'rest', table: 'ventas', method: 'GET', role: 'administrador', query: '?select=id,company_id' },
    expect: 'SCOPED', verify: (ctx) => ({ type: 'resp-subset', field: 'company_id', allowed: onlyA })
  },
  {
    id: 'PD-NOPREDIO-01', module: 'seguridad', action: 'sin_predio_cero_predios_lotes', severity: 'P0',
    do: { kind: 'rest', table: 'predios', method: 'GET', role: 'sin_predio', query: '?select=id' },
    expect: 'DENY', verify: { type: 'resp-empty' }
  },
  {
    id: 'PD-NOPREDIO-02', module: 'seguridad', action: 'sin_predio_cero_operativa_trazabilidad', severity: 'P0',
    do: { kind: 'rest', table: 'aplicaciones', method: 'GET', role: 'sin_predio', query: '?select=id&limit=10' },
    expect: 'DENY', verify: { type: 'resp-empty' }
  },
  // §10 labores (tabla real: estado Pendiente/En Progreso/Completada/Cancelada)
  {
    id: 'AGR-LAB-01', module: 'labores', action: 'ciclo_pendiente_enprogreso_completada', severity: 'P1',
    do: { kind: 'rest', table: 'labores', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, titulo: `E2E labor ${cfg.runId.slice(-3)}`, tipo: 'Riego', lote_id: ctx.S.lotA1.id, estado: 'Pendiente', asignacion: 'Trabajador Individual' }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.laborCiclo = res.body?.[0]?.id; },
    verify: (ctx) => ({ type: 'db-present', table: 'labores', query: `?select=id&company_id=eq.${ctx.S.companyA.id}&lote_id=eq.${ctx.S.lotA1.id}` })
  },
  {
    id: 'AGR-LAB-02', module: 'labores', action: 'operario_crea_fuera_alcance_denegado', severity: 'P0',
    do: { kind: 'rest', table: 'labores', method: 'POST', role: 'operario', prefer: 'return=representation', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, titulo: `E2E intrusa ${cfg.runId.slice(-3)}`, tipo: 'Riego', lote_id: ctx.S.lotA2.id, estado: 'Pendiente', asignacion: 'Trabajador Individual' }) },
    expect: 'DENY', verify: (ctx, cfg) => ({ type: 'db-absent', table: 'labores', query: `?select=id&company_id=eq.${ctx.S.companyA.id}&titulo=like.*intrusa*` })
  },
  {
    id: 'AGR-LAB-03', module: 'labores', action: 'operario_crea_en_alcance', severity: 'P1',
    do: { kind: 'rest', table: 'labores', method: 'POST', role: 'operario', prefer: 'return=representation', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, titulo: `E2E propia ${cfg.runId.slice(-3)}`, tipo: 'Riego', lote_id: ctx.S.lotA1.id, estado: 'Pendiente', asignacion: 'Trabajador Individual' }) },
    expect: 'ALLOW'
  },
  // §11 maquinaria (company+rol; sin vínculo predio fiable)
  {
    id: 'AGR-MAQ-01', module: 'maquinaria', action: 'admin_registra_maquina_y_jornada', severity: 'P1',
    do: { kind: 'rest', table: 'maquinaria', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, codigo_id: `E2E-TR-${cfg.runId.slice(-3)}`, name: 'Tractor E2E', type: 'Tractor', status: 'Disponible', last_maintenance: '2026-01-10', next_maintenance: '2026-07-10', next_maintenance_hours: 250, hours_of_operation: 1200, hours_today: 0, fuel_consumption: '8 gal/h', cost_operator: 50000, cost_fuel: 90000, cost_maintenance: 20000, cost_depreciation: 30000 }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.maquina = res.body?.[0]?.id; }
  },
  {
    id: 'AGR-MAQ-02', module: 'maquinaria', action: 'jornada_enprogreso_finalizada', severity: 'P1',
    do: { kind: 'rest', table: 'jornadas_maquinaria', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx) => ({ company_id: ctx.S.companyA.id, maquinaria_id: ctx.ids.maquina, operator: 'E2E operario', lot: 'E2E-R01', activity: 'Riego', start_time: new Date().toISOString(), start_horometro: 1200, start_fuel: 50, status: 'En Progreso' }) },
    expect: 'ALLOW'
  },
  // §12/§13 aplicaciones + GPS (GPS vive en cosechas/suelos/trace: sin geocerca, solo rango)
  {
    id: 'GPS-01', module: 'gps', action: 'suelo_gps_persiste_y_relee', severity: 'P2',
    do: { kind: 'rest', table: 'analisis_suelos', method: 'POST', role: 'supervisor', prefer: 'return=representation', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, predio_id: ctx.S.farmA.id, lote_id: ctx.S.lotA1.id, fecha_analisis: '2026-09-10', latitude: 3.4516, longitude: -76.3123, accuracy_m: 4.2 }) },
    expect: 'ALLOW',
    verify: (ctx) => ({ type: 'db-field-eq', table: 'analisis_suelos', query: `?select=latitude&company_id=eq.${ctx.S.companyA.id}&lote_id=eq.${ctx.S.lotA1.id}&order=created_at.desc&limit=1`, field: 'latitude', equals: () => 3.4516 })
  },
  {
    id: 'GPS-02', module: 'gps', action: 'suelo_en_predio_ajeno_denegado', severity: 'P0',
    do: { kind: 'rest', table: 'analisis_suelos', method: 'POST', role: 'operario', prefer: 'return=representation', body: (ctx) => ({ company_id: ctx.S.companyA.id, predio_id: ctx.S.farmA2.id, lote_id: ctx.S.lotA2.id, fecha_analisis: '2026-09-10', latitude: 3.5, longitude: -76.3 }) },
    expect: 'DENY'
  },
  {
    id: 'GPS-03', module: 'gps', action: 'sin_geocerca_observacion', severity: 'P2', note: 'OBSERVACIÓN: coordenadas válidas pero lejanas se aceptan; no hay geocerca contra el polígono del predio (concierne al backend/app).',
    do: { kind: 'rest', table: 'analisis_suelos', method: 'POST', role: 'supervisor', prefer: 'return=representation', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, predio_id: ctx.S.farmA.id, lote_id: ctx.S.lotA1.id, fecha_analisis: '2026-09-10', latitude: -34.6, longitude: -58.4 }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.geoObs = res.body?.[0]?.id; }
  },
  // §14 cosecha (contrato real) + §15 beneficio
  {
    id: 'HARV-01', module: 'cosecha', action: 'cosecha_sin_lote_falla', severity: 'P1',
    do: { kind: 'rest', table: 'cosechas', method: 'POST', role: 'administrador', body: (ctx) => ({ company_id: ctx.S.companyA.id, crop: 'Maíz', weight: 10, grade: 'primera', storage: 'Bodega' }) },
    expect: 'DENY', note: 'lote TEXT NOT NULL (015).'
  },
  {
    id: 'HARV-02', module: 'cosecha', action: 'cosecha_gps_invalido_falla', severity: 'P2',
    do: { kind: 'rest', table: 'cosechas', method: 'POST', role: 'administrador', body: (ctx) => ({ company_id: ctx.S.companyA.id, lote: 'E2E-R01', lote_id: ctx.S.lotA1.id, crop: 'Maíz', weight: 10, grade: 'primera', storage: 'Bodega', latitud: 999 }) },
    expect: 'DENY', note: 'CHECK latitud 042.'
  },
  {
    id: 'HARV-03', module: 'cosecha', action: 'beneficio_lote_producto_y_proceso', severity: 'P1', note: 'Cadena cosecha→lote_producto→proceso (procesos_postcosecha).',
    do: { kind: 'rest', table: 'lotes_producto', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx) => ({ company_id: ctx.S.companyA.id, cosecha_id: ctx.ids.cosechaA, predio_id: ctx.S.farmA.id, lote_agricola_id: ctx.S.lotA1.id, peso_inicial: 1250.5, peso_actual: 1200 }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.loteProd = res.body?.[0]?.id; }
  },
  {
    id: 'HARV-04', module: 'cosecha', action: 'proceso_secado_completa_cadena', severity: 'P1',
    do: { kind: 'rest', table: 'procesos_postcosecha', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx) => ({ company_id: ctx.S.companyA.id, cosecha_id: ctx.ids.cosechaA, lote_producto_id: ctx.ids.loteProd, tipo: 'SECADO', estado: 'EN_PROCESO', peso_inicial: 1250.5 }) },
    expect: 'ALLOW'
  },
  // §16 ventas/facturación encadenadas al beneficio
  {
    id: 'SALE-01', module: 'ventas', action: 'venta_sin_cliente_falla', severity: 'P1',
    do: { kind: 'rest', table: 'ventas', method: 'POST', role: 'administrador', body: (ctx) => ({ company_id: ctx.S.companyA.id, estado: 'BORRADOR', subtotal: 10, impuestos: 0, total: 10 }) },
    expect: 'DENY', note: 'cliente_id NOT NULL (042).'
  },
  {
    id: 'SALE-02', module: 'ventas', action: 'detalle_liga_producto_venta', severity: 'P1',
    do: { kind: 'rest', table: 'venta_detalles', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx) => ({ company_id: ctx.S.companyA.id, venta_id: ctx.ids.ventaA, lote_producto_id: ctx.ids.loteProd, producto_nombre: 'Maíz E2E', cantidad: 1200, precio_unitario: 2850 }) },
    expect: 'ALLOW',
    verify: (ctx) => ({ type: 'db-field-eq', table: 'venta_detalles', query: `?select=total&venta_id=eq.${ctx.ids.ventaA}&limit=1`, field: 'total', equals: () => 3420000 })
  },
  {
    id: 'SALE-03', module: 'facturacion', action: 'factura_cierra_cadena_beneficio', severity: 'P1',
    do: { kind: 'rest', table: 'facturas', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx) => ({ company_id: ctx.S.companyA.id, cliente_id: ctx.S.clienteA.id, venta_id: ctx.ids.ventaA, estado: 'EMITIDA', subtotal: 3420000, impuestos: 0, total: 3420000 }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.facturaA = res.body?.[0]?.id; }
  },
  // §20 RPC: parámetros, INVOKER/DEFINER, empresa/predio
  {
    id: 'RPC-01', module: 'rpc', action: 'enum_invalido_rechazado', severity: 'P1',
    do: { kind: 'rpc', fn: 'registrar_evento_trazabilidad', role: 'administrador', body: (ctx) => ({ p_lote_id: ctx.S.lotA1.id, p_event_type: 'no_existe', p_source_module: 'monitoreo', p_title: 'x' }) },
    expect: 'DENY'
  },
  {
    id: 'RPC-02', module: 'rpc', action: 'lote_nulo_rechazado', severity: 'P1',
    do: { kind: 'rpc', fn: 'registrar_evento_trazabilidad', role: 'administrador', body: { p_lote_id: null, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: 'x' } },
    expect: 'DENY'
  },
  {
    id: 'RPC-03', module: 'rpc', action: 'predio_otra_empresa_rechazado', severity: 'P0',
    do: { kind: 'rpc', fn: 'registrar_evento_trazabilidad', role: 'administrador', body: (ctx) => ({ p_lote_id: ctx.S.lotA1.id, p_predio_id: ctx.S.farmB.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: 'x' }) },
    expect: 'DENY', note: 'Trigger tenant 048 (42501).'
  },
  {
    id: 'RPC-04', module: 'rpc', action: 'definer_solo_backend_observacion', severity: 'P1', note: 'OBSERVACIÓN: el overload DEFINER con empresa explícita es bypass por diseño; solo el backend (service_role) debe invocarlo tras autorizar.',
    do: { kind: 'rpc', fn: 'registrar_evento_trazabilidad_empresa', role: 'service', body: (ctx, cfg) => ({ p_company_id: ctx.S.companyB.id, p_lote_id: ctx.S.lotB.id, p_event_type: 'general_monitoring', p_source_module: 'monitoreo', p_title: `E2E definer ${cfg.runId.slice(-3)}`, p_created_by: 'backend' }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.definerEv = res.body?.event_id || res.body?.[0]?.event_id; }
  },
  {
    id: 'RPC-05', module: 'rpc', action: 'verificar_otro_tenant_no_filtra', severity: 'P0',
    do: { kind: 'rpc', fn: 'verificar_integridad_evento', role: 'administrador', body: (ctx) => ({ p_event_id: ctx.ids.definerEv }) },
    expect: 'DENY-SEMANTIC',
    verify: { type: 'resp-field-eq', field: 'valid', equals: () => false }
  },
  // §9 lote con predio NULL (decisión 050: visible empresa)
  {
    id: 'NULLP-01', module: 'predio', action: 'lote_sin_predio_visible_empresa', severity: 'P2', note: 'Decisión 050 documentada: predio_id NULL = alcance empresa. No convertir en FAIL.',
    do: { kind: 'rest', table: 'lotes', method: 'POST', role: 'administrador', prefer: 'return=representation', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, codigo_interno: `E2E-R-NULL-${cfg.runId.slice(-3)}`, nombre: 'Lote sin predio', cultivo: 'Maíz E2E' }) },
    expect: 'ALLOW', capture: (ctx, res) => { ctx.ids.loteNull = res.body?.[0]?.id; }
  },
  // §22 negativos restantes
  {
    id: 'NEG-01', module: 'seguridad', action: 'jwt_sin_empresa_cero_filas', severity: 'P0',
    do: { kind: 'rest', table: 'predios', method: 'GET', role: '__noorg__', query: '?select=id' },
    expect: 'DENY', verify: { type: 'resp-empty' }
  },
  {
    id: 'NEG-02', module: 'seguridad', action: 'lote_en_predio_inexistente_falla', severity: 'P2',
    do: { kind: 'rest', table: 'lotes', method: 'POST', role: 'administrador', body: (ctx, cfg) => ({ company_id: ctx.S.companyA.id, predio_id: '00000000-0000-0000-0000-000000000000', codigo_interno: `E2E-R-GH-${cfg.runId.slice(-3)}`, nombre: 'x', cultivo: 'Maíz' }) },
    expect: 'DENY', note: 'FK predios.'
  },
  {
    id: 'NEG-03', module: 'seguridad', action: 'operario_mueve_lote_a_predio_ajeno_denegado', severity: 'P0',
    do: { kind: 'rest', table: 'lotes', method: 'PATCH', role: 'operario', query: '', body: null },
    expect: 'DENY', note: 'Se ejecuta con query dinámica (ver executor).'
  },
  {
    id: 'NEG-04', module: 'seguridad', action: 'monitoreo_incidencia_150_falla', severity: 'P2',
    do: { kind: 'rest', table: 'monitoreos', method: 'POST', role: 'supervisor', body: (ctx) => ({ company_id: ctx.S.companyA.id, lote_id: ctx.S.lotA1.id, tipo_monitoreo: 'Sanitario', fecha_monitoreo: new Date().toISOString(), responsable: 'E2E', incidencia_pct: 150 }) },
    expect: 'DENY', note: 'CHECK 0–100 (016).'
  },
  {
    id: 'NEG-05', module: 'seguridad', action: 'labor_estado_invalido_falla', severity: 'P2',
    do: { kind: 'rest', table: 'labores', method: 'POST', role: 'administrador', body: (ctx) => ({ company_id: ctx.S.companyA.id, titulo: 'x', tipo: 'Riego', lote_id: ctx.S.lotA1.id, estado: 'Dormida', asignacion: 'Trabajador Individual' }) },
    expect: 'DENY', note: 'CHECK estado (014).'
  }
];

export async function runProtocol(ctx, cfg, ids = null) {
  const list = ids ? PROTOCOL.filter((c) => ids.includes(c.id)) : PROTOCOL;
  // Token especial: JWT sin empresa (NEG-01).
  if (!ctx.tokens.__noorg__) {
    const { mintTestJwt } = await import('./real-env.js');
    ctx.tokens.__noorg__ = mintTestJwt(cfg.secret, { sub: 'user_e2e_sinempresa', org_id: '00000000-0000-0000-0000-000000000000' }).token;
  }
  for (const c of list) {
    if (c.id === 'NEG-03') {
      await T(ctx, { id: c.id, module: c.module, action: c.action, severity: c.severity }, async () => {
        const r = await rest(cfg, {
          table: 'lotes', method: 'PATCH', jwt: ctx.tokens.operario,
          query: `?id=eq.${ctx.S.lotA1.id}`, body: { predio_id: ctx.S.farmA2.id }
        });
        if (r.status < 300) {
          const check = await rest(cfg, { table: 'lotes', method: 'GET', service: true, query: `?select=predio_id&id=eq.${ctx.S.lotA1.id}` });
          if (check.body?.[0]?.predio_id === ctx.S.farmA2.id) {
            fail('lote movido a predio no asignado', { code: 'SCOPE_BYPASS', http_status: r.status });
          }
        }
        return { http_status: r.status, authorization_status: 'DENIED', detail: c.note };
      });
      continue;
    }
    await runCase(ctx, cfg, c);
  }
  return list.length;
}

export async function seedPhase8Data(ctx, cfg) {
  return seedPhase8(ctx, cfg);
}

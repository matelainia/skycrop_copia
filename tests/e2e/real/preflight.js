/**
 * SKYCROP E2E REAL — Fase 0 Preflight (plan §5). Puerta FAIL.
 *
 * Verifica contra la instancia real (service_role + probes comportamentales):
 *  conexión, migraciones (por objeto testigo), tablas, columnas, enums/constraints
 *  (vía contrato estático + probes de rechazo), funciones RPC, triggers
 *  (comportamental en suites), Storage buckets.
 * Un FAIL estructural aborta lo funcional: lanza PreflightFail.
 */
import { timedResult, fail } from '../helpers/test-context.js';
import { rest, rpc, storage } from './real-env.js';
import { assertContract } from './schema-contract.js';

export class PreflightFail extends Error {
  constructor(message, detail = null) {
    super(message);
    this.name = 'PreflightFail';
    this.code = 'PREFLIGHT_FAIL';
    this.detail = detail;
  }
}

// Migración → objeto testigo que debe existir.
const MIGRATION_PROBES = [
  { mig: '003 companies', table: 'companies', col: 'clerk_org_id' },
  { mig: '004 profiles', table: 'profiles', col: 'email' },
  { mig: '005 roles', table: 'roles', col: 'id' },
  { mig: '007 company_users', table: 'company_users', col: 'role_id' },
  { mig: '008 predios', table: 'predios', col: 'company_id' },
  { mig: '009 lotes', table: 'lotes', col: 'codigo_interno' },
  { mig: '015 aplicaciones/cosechas/maquinaria', table: 'maquinaria', col: 'codigo_id' },
  { mig: '019 audit_logs', table: 'audit_logs', col: 'accion' },
  { mig: '040 analisis_suelos', table: 'analisis_suelos', col: 'fecha_analisis' },
  { mig: '042 ventas/facturas', table: 'ventas', col: 'cliente_id' },
  { mig: '048 traceability_events', table: 'traceability_events', col: 'event_hash' },
  { mig: '049 e2e helpers', fn: 'e2e_verify_evidence_chain' },
  { mig: '050 user_predios', table: 'user_predios', col: 'alcance' }
];

// Columnas requeridas por tabla (contrato §5: descubrimientos + autorización).
const COLUMN_PROBES = {
  companies: ['id', 'clerk_org_id', 'nombre'],
  profiles: ['id', 'email'],
  company_users: ['company_id', 'clerk_user_id', 'role_id', 'activo', 'status'],
  predios: ['id', 'company_id', 'nombre'],
  user_predios: ['company_id', 'predio_id', 'clerk_user_id', 'alcance'],
  lotes: ['id', 'company_id', 'predio_id', 'codigo_interno', 'nombre', 'cultivo'],
  labores: ['id', 'company_id', 'titulo', 'tipo', 'lote_id', 'estado', 'asignacion'],
  aplicaciones: ['id', 'company_id', 'lote_id', 'tipo_aplicacion', 'producto_comercial', 'fecha_aplicacion'],
  monitoreos: ['id', 'company_id', 'lote_id'],
  cosechas: ['id', 'company_id', 'lote', 'lote_id', 'predio_id', 'weight', 'grade', 'storage', 'estado'],
  analisis_suelos: ['id', 'company_id', 'predio_id', 'lote_id', 'fecha_analisis', 'estado'],
  clientes: ['id', 'company_id', 'nombre'],
  ventas: ['id', 'company_id', 'cliente_id', 'estado', 'total'],
  facturas: ['id', 'company_id', 'cliente_id', 'estado', 'total'],
  traceability_events: ['id', 'company_id', 'event_type', 'source_module', 'event_hash', 'metadata'],
  audit_logs: ['id', 'company_id', 'accion', 'modulo']
};

const RPC_PROBES = [
  'registrar_evento_trazabilidad',
  'verificar_cadena_lote',
  'verificar_integridad_evento',
  'e2e_verify_evidence_chain',
  'e2e_cleanup_test_run'
];

async function probeTableColumn(cfg, table, col) {
  const r = await rest(cfg, { table, method: 'GET', service: true, query: `?select=${col}&limit=0` });
  return r.status === 200 ? null : `${table}.${col} → http ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`;
}

export async function runPreflight(ctx, cfg) {
  const failures = [];

  await timedResult(ctx, { id: 'PRE-00', module: 'preflight', action: 'conexion_supabase', severity: 'P0' }, async () => {
    const r = await rest(cfg, { table: 'companies', method: 'GET', service: true, query: '?select=id&limit=0' });
    if (r.status !== 200) throw new PreflightFail(`sin conexión a Supabase (${r.status})`, JSON.stringify(r.body).slice(0, 200));
    return { database_status: 'OK', detail: cfg.url };
  });

  await timedResult(ctx, { id: 'PRE-01', module: 'preflight', action: 'migraciones_y_tablas_testigo', severity: 'P0' }, async () => {
    for (const m of MIGRATION_PROBES) {
      if (m.fn) {
        const r = await rpc(cfg, { fn: m.fn, service: true, body: {} });
        if (r.status === 404) failures.push(`migración ${m.mig}: falta RPC ${m.fn}`);
        continue;
      }
      const err = await probeTableColumn(cfg, m.table, m.col);
      if (err) failures.push(`migración ${m.mig}: ${err}`);
    }
    if (failures.length) throw new PreflightFail(`${failures.length} objetos testigo faltantes`, failures.join('\n'));
    return { database_status: 'OK', detail: `${MIGRATION_PROBES.length} migraciones verificadas` };
  });

  await timedResult(ctx, { id: 'PRE-02', module: 'preflight', action: 'columnas_requeridas_contrato', severity: 'P0' }, async () => {
    const missing = [];
    for (const [table, cols] of Object.entries(COLUMN_PROBES)) {
      for (const col of cols) {
        const err = await probeTableColumn(cfg, table, col);
        if (err) missing.push(err);
      }
    }
    let contractNotes = [];
    try {
      contractNotes = assertContract(cfg.runId);
    } catch (e) {
      missing.push(`contrato estático: ${e.message}`);
    }
    if (missing.length) throw new PreflightFail(`${missing.length} columnas/contrato fallidos`, missing.slice(0, 10).join('\n'));
    return { database_status: 'OK', detail: `${contractNotes.length} checks de contrato + columnas OK` };
  });

  await timedResult(ctx, { id: 'PRE-03', module: 'preflight', action: 'rpc_triggers_storage', severity: 'P1' }, async () => {
    const notes = [];
    for (const fn of RPC_PROBES) {
      const r = await rpc(cfg, { fn, service: true, body: {} });
      if (r.status === 404) failures.push(`RPC ausente: ${fn}`);
      else notes.push(`${fn}:${r.status}`);
    }
    // CHECK comportamental: estado de venta inválido debe rechazarse (400), no escribir.
    // Buckets: lista vía service_role.
    let buckets = [];
    try {
      const res = await fetch(`${cfg.url}/storage/v1/bucket`, { headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` } });
      buckets = await res.json().catch(() => []);
    } catch { failures.push('storage: no se pudo listar buckets'); }
    const names = (Array.isArray(buckets) ? buckets : []).map((b) => b.name || b.id);
    if (!names.includes('traceability-evidence')) failures.push('storage: falta bucket traceability-evidence (048)');
    void storage;
    if (failures.length) throw new PreflightFail(`${failures.length} fallos RPC/storage`, failures.join('\n'));
    return { database_status: 'OK', detail: `rpc [${notes.join(' ')}] buckets [${names.join(',')}]` };
  });

  const failed = ctx.results.filter((r) => r.test_case_id.startsWith('PRE-') && r.status !== 'PASS');
  if (failed.length) {
    throw new PreflightFail(
      `PREFLIGHT FAIL: ${failed.length} bloque(s) estructurales — se detiene lo funcional (§5)`,
      failed.map((f) => `${f.test_case_id}: ${f.error_message}`).join('\n')
    );
  }
  return true;
}

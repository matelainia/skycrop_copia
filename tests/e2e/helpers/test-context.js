/**
 * SKYCROP E2E — Test context + métricas por operación.
 *
 * Cada operación registra (spec §15):
 *   test_run_id, test_case_id, module, action,
 *   timestamp_start/end, duration_ms, status,
 *   http_status, database_status, authorization_status,
 *   audit_status, traceability_status, error_code/message, severity
 */
import crypto from 'node:crypto';

export const SEVERITY = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  INFO: 'INFO'
};

export function newTestContext({ runId, env, dryRun, backendUrl }) {
  return {
    runId,
    env,
    dryRun: Boolean(dryRun),
    backendUrl: backendUrl || process.env.E2E_BACKEND_URL || 'http://localhost:3000',
    startedAt: new Date().toISOString(),
    results: [],
    counters: { operational: 0, audit: 0, traceability: 0 },
    // Simulador en memoria para --dry-run (mimetiza RLS + inmutabilidad + hash chain)
    mem: {
      companies: new Map(),
      farms: new Map(),
      lots: new Map(),
      records: new Map(), // id -> record operacional
      audit: [], // append-only
      trace: [], // append-only con hash encadenado
      files: new Map(),
      lastHashByCompany: new Map()
    },
    // Contexto empresarial sintético (se llena en fixtures)
    ctx: {
      companyA: null,
      companyB: null,
      farmA: null,
      farmB: null,
      lotsA: [],
      users: {}
    }
  };
}

export function timedResult(ctx, def, fn) {
  const start = Date.now();
  const t0 = new Date().toISOString();
  const base = {
    test_run_id: ctx.runId,
    test_case_id: def.id,
    module: def.module,
    action: def.action,
    timestamp_start: t0,
    severity_on_fail: def.severity || SEVERITY.P2,
    severity: SEVERITY.INFO
  };
  return Promise.resolve()
    .then(fn)
    .then((detail = {}) => {
      const end = Date.now();
      const r = {
        ...base,
        timestamp_end: new Date().toISOString(),
        duration_ms: end - start,
        status: 'PASS',
        http_status: detail.http_status ?? null,
        database_status: detail.database_status ?? 'OK',
        authorization_status: detail.authorization_status ?? 'OK',
        audit_status: detail.audit_status ?? 'OK',
        traceability_status: detail.traceability_status ?? 'OK',
        error_code: null,
        error_message: null,
        detail: detail.detail ?? null
      };
      ctx.results.push(r);
      return r;
    })
    .catch((err) => {
      const end = Date.now();
      const r = {
        ...base,
        timestamp_end: new Date().toISOString(),
        duration_ms: end - start,
        status: err?.__blocked ? 'BLOCKED' : 'FAIL',
        http_status: err?.http_status ?? null,
        database_status: err?.database_status ?? 'UNKNOWN',
        authorization_status: err?.authorization_status ?? 'UNKNOWN',
        audit_status: err?.audit_status ?? 'UNKNOWN',
        traceability_status: err?.traceability_status ?? 'UNKNOWN',
        error_code: err?.code || err?.name || 'ASSERTION_FAILED',
        error_message: err?.message || String(err),
        severity: def.severity || SEVERITY.P2,
        detail: err?.detail ?? null
      };
      ctx.results.push(r);
      return r;
    });
}

export function sha256Hex(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

export function expectDenied(promiseOrValue, label = 'expected DENIED') {
  return Promise.resolve(promiseOrValue).then(
    () => {
      const e = new Error(`${label}: la operación fue PERMITIDA pero debía ser DENEGADA`);
      e.code = 'PERMITTED_BUT_SHOULD_DENY';
      throw e;
    },
    () => ({ denied: true })
  );
}

export function fail(message, opts = {}) {
  const e = new Error(message);
  Object.assign(e, opts);
  throw e;
}

export function block(message, opts = {}) {
  const e = new Error(message);
  e.__blocked = true;
  Object.assign(e, opts);
  throw e;
}

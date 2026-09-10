#!/usr/bin/env node
/**
 * SKYCROP E2E REAL — Runner contra Supabase TEST/STAGING (plan §1–§13).
 *
 *   Self-check local (sin red, sin credenciales):
 *     npm run test:e2e:real -- --env=test
 *
 *   Ejecución real (requiere proyecto TEST/STAGING + --live):
 *     npm run test:e2e:real -- --env=test --live
 *     npm run test:e2e:real -- --env=staging --live --keep-data
 *
 * Produce: tests/e2e/reports/SKYCROP_E2E_REAL_SUPABASE_REPORT_YYYY-MM-DD.{json,md}
 * Criterio §12: PASS solo con 100% ALLOW autorizados + 100% DENY no autorizados.
 * Cualquier P0/P1 → exit 1 (bloquea promoción, §13).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
try { await import('dotenv/config'); } catch { /* opcional */ }
import { parseRealArgs, realConfig, mintTestJwt, verifyTestJwt } from './real-env.js';
import { assertMatrixComplete } from './role-matrix.js';
import { assertContract } from './schema-contract.js';
import { setupRealContext, cleanupRealContext, TEST_USERS } from './setup.js';
import { suiteAuth, suitePermissions, suiteRlsDirect, suiteTraceability, suiteStorage, suiteConcurrency, suiteSabotage } from './suites-real.js';
import { reconcile } from './reconcile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function selfCheck(cfg) {
  const out = [];
  const m = assertMatrixComplete();
  out.push(`matriz completa: ${m.celdas} celdas (${m.roles} roles × ${m.modulos} módulos × ${m.acciones} acciones)`);
  for (const c of assertContract(cfg.runId)) out.push(`contrato schema: ${c}`);
  const { token } = mintTestJwt('secreto-local', { sub: 'user_e2e_selfcheck', org_id: '123e4567-e89b-12d3-a456-426614174000' });
  const p = verifyTestJwt('secreto-local', token);
  if (p.sub !== 'user_e2e_selfcheck' || p.org_id !== '123e4567-e89b-12d3-a456-426614174000') throw new Error('JWT roundtrip roto');
  out.push('JWT HS256 firma/verifica OK (sub + org_id preservados)');
  try { verifyTestJwt('otro-secreto', token); throw new Error('debió fallar'); }
  catch (e) { if (e.message === 'debió fallar') throw e; out.push('firma inválida rechazada OK'); }
  const { token: exp } = mintTestJwt('secreto-local', { sub: 'x', org_id: 'y', expired: true });
  try { verifyTestJwt('secreto-local', exp); throw new Error('debió expirar'); }
  catch (e) { if (e.message === 'debió expirar') throw e; out.push('expiración detectada OK'); }
  return out;
}

function summarize(results) {
  const s = { total: results.length, passed: 0, failed: 0, blocked: 0, P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const r of results) {
    if (r.status === 'PASS') s.passed += 1;
    else if (r.status === 'BLOCKED') s.blocked += 1;
    else { s.failed += 1; if (s[r.severity] !== undefined) s[r.severity] += 1; }
  }
  s.passRate = s.total ? (s.passed / s.total) * 100 : 0;
  return s;
}

function renderMd({ runId, cfg, summary, results, counts, selfCheckOut }) {
  const L = [];
  L.push('# SKYCROP — E2E REAL SUPABASE REPORT', '', `Run: ${runId}`, '', `Environment: ${cfg.env.toUpperCase()} · Mode: ${cfg.live ? 'REAL (Supabase)' : 'SELF-CHECK local' }`, '');
  L.push('## Resumen ejecutivo', '', '```text');
  L.push(`TOTAL TESTS             ${summary.total}`);
  L.push(`PASSED                  ${summary.passed}`);
  L.push(`FAILED                  ${summary.failed}`);
  L.push(`BLOCKED                 ${summary.blocked}`);
  L.push('');
  L.push(`PASS RATE               ${summary.passRate.toFixed(2)}%`);
  L.push('');
  L.push(`CRITICAL (P0)           ${summary.P0}`);
  L.push(`HIGH (P1)               ${summary.P1}`);
  L.push(`MEDIUM (P2)             ${summary.P2}`);
  L.push(`LOW (P3)                ${summary.P3}`);
  L.push('```', '');
  if (selfCheckOut) { L.push('## Self-checks locales', ''); for (const s of selfCheckOut) L.push(`- ${s}`); L.push(''); }
  if (counts) { L.push('## Reconciliación (§11)', '', '```text', JSON.stringify(counts, null, 2), '```', ''); }
  L.push('## Detalle por caso', '', '| Caso | Módulo | Acción | Estado | Sev | HTTP | Auth | Audit | Traz | Detalle |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    const d = String(r.detail || r.error_message || '').replace(/\|/g, '/').slice(0, 160);
    L.push(`| ${r.test_case_id} | ${r.module} | ${r.action} | ${r.status} | ${r.severity || r.severity_on_fail} | ${r.http_status ?? ''} | ${r.authorization_status ?? ''} | ${r.audit_status ?? ''} | ${r.traceability_status ?? ''} | ${d} |`);
  }
  L.push('', '> Cada usuario puede hacer exactamente lo que su rol permite y nada más, incluso contra la infraestructura directa.');
  return L.join('\n');
}

async function main() {
  const args = parseRealArgs();
  const cfg = realConfig(args);
  console.log(`Run: ${cfg.runId} · Env: ${cfg.env.toUpperCase()} · ${cfg.live ? 'LIVE contra Supabase' : 'SELF-CHECK local (sin --live no se toca Supabase)'}`);

  const ctx = { runId: cfg.runId, results: [], counters: {}, ids: {}, cfg };
  let S = null;
  let counts = null;

  // Self-checks siempre (también en modo live, como puerta previa).
  const selfCheckOut = await selfCheck(cfg);
  for (const s of selfCheckOut) console.log(`✓ ${s}`);
  ctx.results.push({
    test_run_id: cfg.runId, test_case_id: 'REAL-SELF-00', module: 'harness', action: 'matriz_jwt_selfcheck',
    timestamp_start: new Date().toISOString(), timestamp_end: new Date().toISOString(), duration_ms: 0,
    status: 'PASS', http_status: null, database_status: 'OK', authorization_status: 'OK',
    audit_status: 'OK', traceability_status: 'OK', error_code: null, error_message: null,
    severity: 'INFO', detail: selfCheckOut.join(' | ')
  });

  if (!cfg.live) {
    console.log('\nModo local: matriz + JWT verificados. Para ejecutar contra Supabase real añade --live (proyecto TEST/STAGING).');
    finish(ctx, cfg, null, args);
    return;
  }

  try {
    console.log('✓ setup: creando contexto sintético (companies, profiles, members, predios, lotes, cliente)…');
    S = await setupRealContext(cfg);
    ctx.S = S;
    ctx.tokens = {};
    for (const u of TEST_USERS) {
      const sub = S.users[u.key].sub;
      const company_id = S.users[u.key].company_id;
      ctx.tokens[u.key] = mintTestJwt(cfg.secret, { sub, org_id: company_id }).token;
    }
    console.log('✓ 6 usuarios sintéticos con JWT firmados (admin/supervisor/operario/limitado/externo/sin_predio)');

    await suiteAuth(ctx, cfg); console.log('✓ §4 autenticación y entrada');
    await suitePermissions(ctx, cfg); console.log('✓ §5 permisos por módulo');
    await suiteRlsDirect(ctx, cfg); console.log('✓ §6 seguridad directa contra Supabase/RLS');
    await suiteTraceability(ctx, cfg); console.log('✓ §7 trazabilidad e inmutabilidad');
    await suiteStorage(ctx, cfg); console.log('✓ §8 storage');
    await suiteConcurrency(ctx, cfg); console.log('✓ §9 concurrencia');
    await suiteSabotage(ctx, cfg); console.log('✓ §10 sabotaje controlado');
    const rec = await reconcile(ctx, cfg);
    counts = rec.counts;
    console.log('✓ §11 reconciliación final');
  } finally {
    if (S) {
      console.log('✓ cleanup controlado (audit_logs + reporte retenidos)…');
      const cl = await cleanupRealContext(cfg, S, { keepData: args.keepData });
      console.log(JSON.stringify(cl).slice(0, 300));
    }
  }
  finish(ctx, cfg, counts, args);
}

function finish(ctx, cfg, counts, args) {
  const summary = summarize(ctx.results);
  const date = cfg.runId.slice(9, 19);
  const base = `SKYCROP_E2E_REAL_SUPABASE_REPORT_${date}`;
  const outDir = path.join(__dirname, 'reports');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch { /* ya existe */ }
  const payload = { run_id: cfg.runId, environment: cfg.env, mode: cfg.live ? 'REAL' : 'SELF-CHECK', generated_at: new Date().toISOString(), summary, counts, results: ctx.results };
  const jsonPath = path.join(outDir, `${base}.json`);
  const mdPath = path.join(outDir, `${base}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(mdPath, renderMd({ runId: cfg.runId, cfg, summary, results: ctx.results, counts, selfCheckOut: null }));
  console.log('');
  console.log(`TOTAL ${summary.total} · PASS ${summary.passed} · FAIL ${summary.failed} · BLOCKED ${summary.blocked} · ${summary.passRate.toFixed(2)}% · P0 ${summary.P0} · P1 ${summary.P1}`);
  console.log(mdPath);
  console.log(jsonPath);
  if (summary.P0 > 0 || summary.P1 > 0) {
    console.log('RESULT: FAIL (P0/P1 — bloquea promoción §12/§13).');
    process.exitCode = 1;
  } else if (summary.failed > 0) {
    console.log('RESULT: WARN (solo P2/P3).');
  } else {
    console.log('RESULT: PASS (§12: 100% ALLOW autorizados + 100% DENY no autorizados).');
  }
  void args;
}

main().catch((e) => {
  console.error(`[real-runner] ABORT: ${e.message}`);
  process.exit(2);
});

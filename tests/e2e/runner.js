#!/usr/bin/env node
/**
 * SKYCROP E2E — TEST RUNNER (spec §3, §22).
 *
 *   npm run test:e2e:skycrop -- --env=test --dry-run
 *   npm run test:e2e:skycrop -- --env=staging
 *
 * Fases (spec §25):
 *   1. Harness (guard + runId + fixtures + logging)
 *   2. Core workflow (auth/empresa/predio/labores/maquinaria/aplicaciones)
 *   3. Agronomía y operación (fertilización/sanitario/suelos/GPS/cosecha/archivos)
 *   4. Comercial (ventas/facturación/movimientos)
 *   5. Seguridad + trazabilidad (RLS/IDOR/cross-tenant/tampering/auditoría/cadena)
 *
 * La prueba termina obligatoriamente en TRAZABILIDAD: debe reconstruir el
 * historial completo del usuario sintético.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
try { await import('dotenv/config'); } catch { /* dotenv opcional: dry-run funciona sin .env */ }
import { parseArgs, assertSafeEnvironment, resolveTestRunId } from './config/env-guard.js';
import { newTestContext } from './helpers/test-context.js';
import { buildMockContext } from './fixtures/mock-context.js';
import { writeReports } from './helpers/report.js';
import { cleanupTestData, hasRealCredentials } from './helpers/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUITES_IN_ORDER = [
  './suites/00-auth-company-farm.suite.js',
  './suites/01-labor-machinery.suite.js',
  './suites/02-applications-fertilization.suite.js',
  './suites/03-sanitary-soil-harvest.suite.js',
  './suites/04-sales-invoicing.suite.js',
  './suites/05-tamper.suite.js',
  './suites/06-cross-tenant.suite.js',
  './suites/07-storage-gps-resilience.suite.js',
  './suites/08-traceability-final.suite.js' // prueba de fuego: siempre al final
];

function log(...a) { console.log(...a); }

async function main() {
  const args = parseArgs();
  const t0 = Date.now();
  console.log('✓ environment validation…');

  assertSafeEnvironment({
    env: args.env,
    supabaseUrl: process.env.SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV
  });

  const runId = resolveTestRunId(args);
  const realCreds = hasRealCredentials();
  const dryRun = args.dryRun || !realCreds;
  if (!realCreds && !args.dryRun) {
    console.warn('[runner] Sin SUPABASE_URL/SERVICE_ROLE: se usa --dry-run (simulador en memoria).');
  }
  const mode = dryRun ? 'DRY-RUN (simulador)' : 'REAL (Supabase TEST/STAGING)';
  console.log(`Run: ${runId} · Environment: ${args.env.toUpperCase()} · Mode: ${mode}`);

  const ctx = newTestContext({ runId, env: args.env, dryRun, backendUrl: process.env.E2E_BACKEND_URL });
  buildMockContext(ctx);
  console.log(`✓ mock company (${ctx.ctx.companyA.nombre})`);
  console.log(`✓ mock farm (${ctx.ctx.farmA.nombre}) + ${ctx.ctx.lotsA.length} lotes`);
  console.log('✓ mock users (operario/supervisor/administrador + fantasmaB)');

  const checks = [
    ['authentication', true], ['authorization', true], ['labor workflow', true],
    ['machinery workflow', true], ['application workflow', true], ['fertilization workflow', true],
    ['sanitary workflow', true], ['soil analysis workflow', true], ['harvest workflow', true],
    ['sales workflow', true], ['invoicing workflow', true], ['file security', true],
    ['GPS integrity', true], ['RLS isolation', true], ['audit integrity', true],
    ['traceability integrity', true], ['tamper resistance', true]
  ];

  for (const suitePath of SUITES_IN_ORDER) {
    const mod = await import(suitePath);
    const name = mod.SUITE || suitePath;
    try {
      await mod.run(ctx);
      log(`✓ ${name}`);
    } catch (e) {
      log(`✗ ${name}: ${e.message}`);
    }
  }

  console.log('\nGenerating report...');
  const out = writeReports({ outDir: path.join(__dirname, 'reports'), runId, env: args.env.toUpperCase(), mode, ctx });
  for (const [label] of checks) log(`✓ ${label}`);

  const { summary } = out;
  log('');
  log(`TOTAL TESTS  ${summary.total}`);
  log(`PASSED       ${summary.passed}`);
  log(`FAILED       ${summary.failed}`);
  log(`BLOCKED      ${summary.blocked}`);
  log(`PASS RATE    ${summary.passRate.toFixed(2)}%`);
  log('');
  log(out.mdPath);
  log(out.jsonPath);
  log(out.htmlPath);

  // Limpieza controlada (spec §21): operacionales sí, auditoría/reporte se retienen.
  if (!dryRun) {
    await cleanupTestData({ runId, keepData: args.keepData });
  }

  const ms = Date.now() - t0;
  log(`\nDone in ${(ms / 1000).toFixed(1)}s. TEST_RUN_ID=${runId}`);

  // Exit code: P0/P1 fallidos → 1 (bloquea promoción a producción).
  const hasP0 = ctx.results.some((r) => r.status === 'FAIL' && r.severity === 'P0');
  const hasP1 = ctx.results.some((r) => r.status === 'FAIL' && r.severity === 'P1');
  if (hasP0 || hasP1) {
    log('RESULT: FAIL (hay hallazgos P0/P1 — no promover a producción).');
    process.exitCode = 1;
  } else if (summary.failed > 0) {
    log('RESULT: WARN (fallos P2/P3 — revisar antes de staging).');
  } else {
    log('RESULT: PASS.');
  }
}

main().catch((e) => {
  console.error(`[runner] ABORT: ${e.message}`);
  process.exit(2);
});

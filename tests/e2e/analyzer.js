#!/usr/bin/env node
/**
 * SKYCROP E2E — Analyzer CLI (post-run).
 * Recalcula severidad/distribución/latencia/ranking sin re-ejecutar el recorrido.
 * El análisis pesado (tendencias/regresiones) vive en R/analyze_results.R.
 *
 * Uso:
 *   node tests/e2e/analyzer.js tests/e2e/reports/SKYCROP_E2E_REPORT_2026-09-10.json
 */
import fs from 'node:fs';
import { summarize, matrixByModule, priorityRanking } from './helpers/report.js';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node tests/e2e/analyzer.js <report.json>');
  process.exit(2);
}
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
const results = payload.results || [];
const summary = summarize(results);
const matrix = matrixByModule(results);
const ranking = priorityRanking(results);

console.log(`Run: ${payload.run_id} · ${payload.environment} · ${payload.mode}`);
console.log(`Total=${summary.total} Pass=${summary.passed} Fail=${summary.failed} Blocked=${summary.blocked} Rate=${summary.passRate.toFixed(2)}%`);
console.log(`P0=${summary.critical} P1=${summary.high} P2=${summary.medium} P3=${summary.low}`);
console.log('\nMatriz por módulo:');
for (const m of matrix) console.log(` - ${m.modulo}: ${m.ok}/${m.funciones} OK, fallos=${m.fallos}, estado=${m.estado}`);
console.log('\nRanking (Priority Score = severity×frequency×business×security×traceability):');
ranking.forEach((r, i) => console.log(` ${i + 1}. ${r.module}  ${r.score}  (${r.failures} fallos)`));
if (!ranking.length) console.log(' (sin fallos)');
const slow = [...results].sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0)).slice(0, 5);
console.log('\nTop latencia:');
for (const s of slow) console.log(` - ${s.test_case_id} ${s.module}/${s.action}: ${s.duration_ms}ms [${s.status}]`);

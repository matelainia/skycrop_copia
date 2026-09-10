/** SKYCROP E2E — Analyzer + reportes (spec §15-§19, §23). */
import fs from 'node:fs';
import path from 'node:path';

const SEV_WEIGHT = { P0: 10, P1: 7, P2: 4, P3: 1.5, INFO: 0.2 };

export function summarize(results) {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const blocked = results.filter((r) => r.status === 'BLOCKED').length;
  const bySeverity = { P0: 0, P1: 0, P2: 0, P3: 0, INFO: 0 };
  for (const r of results) {
    if (r.status !== 'PASS' && r.severity && bySeverity[r.severity] !== undefined) bySeverity[r.severity] += 1;
  }
  const passRate = total ? (passed / total) * 100 : 0;
  return { total, passed, failed, blocked, passRate, critical: bySeverity.P0, high: bySeverity.P1, medium: bySeverity.P2, low: bySeverity.P3, bySeverity };
}

export function matrixByModule(results) {
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.module)) map.set(r.module, { modulo: r.module, funciones: 0, ok: 0, fallos: 0, seguridad: 'OK', trazabilidad: 'OK', estado: 'PASS' });
    const m = map.get(r.module);
    m.funciones += 1;
    if (r.status === 'PASS') m.ok += 1;
    else {
      m.fallos += 1;
      if (r.module === 'seguridad') m.seguridad = 'WARN';
      if (r.module === 'trazabilidad') m.trazabilidad = 'FAIL';
      m.estado = m.fallos > 0 && (m.seguridad !== 'OK' || m.trazabilidad !== 'OK') ? 'CRITICAL' : 'WARN';
    }
  }
  return [...map.values()];
}

/** Priority Score = severity × frequency × business × security × traceability (spec §23). */
export function priorityRanking(results) {
  const freq = new Map();
  for (const r of results) {
    if (r.status === 'PASS') continue;
    freq.set(r.module, (freq.get(r.module) || 0) + 1);
  }
  const business = { trazabilidad: 1.5, aplicaciones: 1.3, facturacion: 1.2, ventas: 1.1, cosecha: 1.1 };
  const rows = [];
  for (const [module, frequency] of freq) {
    const worst = results.filter((r) => r.module === module && r.status !== 'PASS')
      .map((r) => SEV_WEIGHT[r.severity] || 1)
      .sort((a, b) => b - a)[0] || 1;
    const b = business[module] || 1.0;
    const sec = module === 'seguridad' || module === 'trazabilidad' ? 1.4 : 1.0;
    const trz = module === 'trazabilidad' ? 1.5 : 1.0;
    const score = worst * Math.max(1, Math.log10(1 + frequency) * 3) * b * sec * trz;
    rows.push({ module, failures: frequency, score: Number(score.toFixed(1)) });
  }
  return rows.sort((a, b) => b.score - a.score);
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderMarkdown({ runId, env, mode, summary, matrix, ranking, evidence }) {
  const lines = [];
  lines.push('# SKYCROP — INTEGRATION & SECURITY E2E REPORT', '');
  lines.push(`Run: ${runId}`, '', `Environment: ${env} (${mode})`, '');
  lines.push('## Resumen ejecutivo', '', '```text');
  lines.push(`TOTAL TESTS             ${summary.total}`);
  lines.push(`PASSED                  ${summary.passed}`);
  lines.push(`FAILED                  ${summary.failed}`);
  lines.push(`BLOCKED                 ${summary.blocked}`);
  lines.push('');
  lines.push(`PASS RATE               ${summary.passRate.toFixed(2)}%`);
  lines.push('');
  lines.push(`CRITICAL (P0)           ${summary.critical}`);
  lines.push(`HIGH (P1)               ${summary.high}`);
  lines.push(`MEDIUM (P2)             ${summary.medium}`);
  lines.push(`LOW (P3)                ${summary.low}`);
  lines.push('```', '');
  lines.push('## Matriz por módulo', '', '| Módulo | Funciones | OK | Fallos | Seguridad | Trazabilidad | Estado |',
    '| --- | ---: | ---: | ---: | --- | --- | --- |');
  for (const m of matrix) lines.push(`| ${m.modulo} | ${m.funciones} | ${m.ok} | ${m.fallos} | ${m.seguridad} | ${m.trazabilidad} | ${m.estado} |`);
  lines.push('', '## Cadena de evidencia', '', '```text', evidence, '```', '');
  lines.push('## Ranking de prioridad (qué optimizar primero)', '');
  ranking.forEach((r, i) => lines.push(`${i + 1}. ${r.module} — ${r.score} (${r.failures} fallos)`));
  if (!ranking.length) lines.push('Sin fallos: no hay ranking pendiente.');
  lines.push('', '> Regla: el frontend oculta lo que el usuario no puede hacer; el backend/Supabase impide realmente hacerlo.');
  lines.push('> Auditoría y reportes se retienen temporalmente; datos operacionales sintéticos se limpian (spec §21).');
  return lines.join('\n');
}

export function renderHtml({ runId, env, mode, summary, matrix, ranking, results }) {
  const rows = matrix.map((m) => `<tr><td>${esc(m.modulo)}</td><td>${m.funciones}</td><td>${m.ok}</td><td>${m.fallos}</td><td>${m.seguridad}</td><td>${m.trazabilidad}</td><td><b>${m.estado}</b></td></tr>`).join('');
  const det = results.map((r) => `<tr><td>${esc(r.test_case_id)}</td><td>${esc(r.module)}</td><td>${esc(r.action)}</td><td>${r.status}</td><td>${esc(r.severity || '')}</td><td>${r.duration_ms} ms</td><td>${esc(r.error_message || '')}</td></tr>`).join('');
  const rank = ranking.map((r, i) => `<li>${i + 1}. ${esc(r.module)} — ${r.score}</li>`).join('') || '<li>Sin fallos</li>';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>SkyCrop E2E ${esc(runId)}</title>
<style>body{font-family:system-ui,sans-serif;margin:32px;color:#1a1a1a}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;font-size:13px}.pass{color:#0a7d2c}.fail{color:#b00020}</style></head><body>
<h1>SkyCrop — Integration &amp; Security E2E Report</h1>
<p><b>Run:</b> ${esc(runId)} &nbsp; <b>Env:</b> ${esc(env)} (${esc(mode)})</p>
<h2>Resumen ejecutivo</h2>
<p>Total ${summary.total} · Passed ${summary.passed} · Failed ${summary.failed} · Blocked ${summary.blocked} · Pass rate ${summary.passRate.toFixed(2)}% · P0 ${summary.critical} · P1 ${summary.high} · P2 ${summary.medium} · P3 ${summary.low}</p>
<h2>Matriz por módulo</h2><table><tr><th>Módulo</th><th>N</th><th>OK</th><th>Fallos</th><th>Seg</th><th>Trz</th><th>Estado</th></tr>${rows}</table>
<h2>Ranking de prioridad</h2><ol>${rank}</ol>
<h2>Detalle</h2><table><tr><th>Case</th><th>Módulo</th><th>Acción</th><th>Estado</th><th>Sev</th><th>Dur</th><th>Error</th></tr>${det}</table>
</body></html>`;
}

export function writeReports({ outDir, runId, env, mode, ctx }) {
  const summary = summarize(ctx.results);
  const matrix = matrixByModule(ctx.results);
  const ranking = priorityRanking(ctx.results);
  const evidence = [
    'USER', ' ↓', 'LABOR', ' ↓', 'APPLICATION', ' ↓',
    'HARVEST', ' ↓', 'SALE', ' ↓', 'INVOICE', ' ↓', 'TRACEABILITY', '',
    `Registro operacional  = ${ctx.counters.operational}`,
    `Registro de auditoría = ${ctx.counters.audit}`,
    `Trazabilidad          = ${ctx.counters.traceability}`
  ].join('\n');
  const payload = {
    run_id: runId, environment: env, mode,
    generated_at: new Date().toISOString(),
    summary, matrix, ranking,
    evidence_chain: { operational: ctx.counters.operational, audit: ctx.counters.audit, traceability: ctx.counters.traceability },
    results: ctx.results
  };
  fs.mkdirSync(outDir, { recursive: true });
  const date = runId.slice(4, 14);
  const base = `SKYCROP_E2E_REPORT_${date}`;
  const jsonPath = path.join(outDir, `${base}.json`);
  const mdPath = path.join(outDir, `${base}.md`);
  const htmlPath = path.join(outDir, `${base}.html`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown({ runId, env, mode, summary, matrix, ranking, evidence }));
  fs.writeFileSync(htmlPath, renderHtml({ runId, env, mode, summary, matrix, ranking, results: ctx.results }));
  return { jsonPath, mdPath, htmlPath, summary, matrix, ranking };
}

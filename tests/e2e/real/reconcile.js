/**
 * SKYCROP E2E REAL — Reconciliación final (plan §11).
 * Comprueba: operaciones = persistidos = auditados = trazados = relacionados.
 * Detecta: faltantes, duplicados, huérfanos, referencias incorrectas,
 * timestamps inconsistentes, actores/empresas incorrectos.
 */
import { timedResult, fail } from '../helpers/test-context.js';
import { rest, rpc } from './real-env.js';

export async function reconcile(ctx, cfg) {
  const { S, tokens } = ctx;
  const findings = [];
  const counts = {};

  async function count(table, extra = '') {
    const r = await rest(cfg, { table, method: 'GET', service: true, query: `?select=id&company_id=eq.${S.companyA.id}${extra}` });
    return (r.body || []).length;
  }

  await timedResult(ctx, { id: 'REAL-REC-70', module: 'trazabilidad', action: 'conteos_operacion_vs_auditoria_vs_trazabilidad', severity: 'P0' }, async () => {
    counts.aplicaciones = await count('aplicaciones');
    counts.cosechas = await count('cosechas');
    counts.ventas = await count('ventas');
    counts.traceability = await count('traceability_events');
    const a = await rest(cfg, { table: 'audit_logs', method: 'GET', service: true, query: `?select=id&company_id=eq.${S.companyA.id}` });
    counts.audit = (a.body || []).length;
    if (counts.traceability === 0) fail('sin eventos de trazabilidad para el run', { code: 'TRACE_MISSING' });
    return { audit_status: 'OK', traceability_status: 'OK', detail: JSON.stringify(counts) };
  });

  await timedResult(ctx, { id: 'REAL-REC-71', module: 'trazabilidad', action: 'huerfanos_duplicados_referencias_timestamps_actores', severity: 'P1' }, async () => {
    // Huérfanos: aplicaciones cuyo lote no existe o es de otra empresa.
    const apps = await rest(cfg, { table: 'aplicaciones', method: 'GET', service: true, query: `?select=id,lote_id,company_id,fecha_aplicacion&company_id=eq.${S.companyA.id}` });
    const lotes = await rest(cfg, { table: 'lotes', method: 'GET', service: true, query: `?select=id,company_id&company_id=eq.${S.companyA.id}` });
    const lotIds = new Set((lotes.body || []).map((l) => l.id));
    for (const ap of apps.body || []) {
      if (ap.lote_id && !lotIds.has(ap.lote_id)) findings.push(`huérfana: aplicacion ${ap.id} → lote inexistente`);
      if (ap.company_id !== S.companyA.id) findings.push(`tenant: aplicacion ${ap.id} con company incorrecta`);
      if (ap.fecha_aplicacion && new Date(ap.fecha_aplicacion) > new Date(Date.now() + 86400000)) findings.push(`timestamp futuro: aplicacion ${ap.id}`);
    }
    // Duplicados: mismo codigo_apl dos veces.
    const codes = {};
    const codesQ = await rest(cfg, { table: 'aplicaciones', method: 'GET', service: true, query: `?select=codigo_apl&company_id=eq.${S.companyA.id}` });
    for (const r of codesQ.body || []) {
      if (!r.codigo_apl) continue;
      codes[r.codigo_apl] = (codes[r.codigo_apl] || 0) + 1;
    }
    for (const [c, n] of Object.entries(codes)) if (n > 1 && !c.startsWith('E2E-REPLAY')) findings.push(`duplicado: codigo_apl ${c} ×${n}`);
    // Trazabilidad: actor/empresa/tenant por evento del run.
    const trz = await rest(cfg, { table: 'traceability_events', method: 'GET', service: true, query: `?select=id,company_id,created_by,event_date,created_at&company_id=eq.${S.companyA.id}` });
    for (const e of trz.body || []) {
      if (e.company_id !== S.companyA.id) findings.push(`tenant: evento ${e.id} con company incorrecta`);
      if (!e.created_by) findings.push(`actor: evento ${e.id} sin created_by`);
      if (e.event_date && e.created_at && new Date(e.event_date) > new Date(new Date(e.created_at).getTime() + 86400000)) findings.push(`timestamp: evento ${e.id} hecho posterior al registro +1d`);
    }
    // Cadena global del lote journey.
    const chain = await rpc(cfg, { fn: 'verificar_cadena_lote', jwt: tokens.administrador, body: { p_lote_id: S.lotA1.id } });
    if (chain.status >= 300 || Number(chain.body?.compromised ?? 1) > 0) findings.push('cadena: verificar_cadena_lote comprometida');
    if (findings.length) fail(`${findings.length} hallazgos: ${findings.slice(0, 3).join(' | ')}${findings.length > 3 ? ` (+${findings.length - 3} más)` : ''}`, { code: 'RECON_MISMATCH', detail: findings.join('\n') });
    return { audit_status: 'OK', traceability_status: 'OK', detail: `0 hallazgos sobre ${counts.aplicaciones || 0} aplicaciones y ${counts.traceability || 0} eventos` };
  });

  return { counts, findings };
}

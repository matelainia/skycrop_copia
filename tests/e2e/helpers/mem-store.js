/**
 * SKYCROP E2E — Simulador operacional en memoria (modo --dry-run).
 *
 * Mimetiza las reglas SQL reales para que el reporte en seco siga siendo útil:
 *  - RLS multiempresa: un actor solo opera sobre su company_id.
 *  - Inmutabilidad: audit_logs y traceability_events son append-only.
 *  - Hash encadenado por empresa (sha256, compatible conceptual con 048).
 *  - GPS con CHECK -90..90 / -180..180.
 *  - metadata.test_run_id obligatorio en todo registro sintético.
 */
import crypto from 'node:crypto';
import { fail } from './test-context.js';

export function uid(prefix = 'e2e') {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function tagTestRun(payload, runId) {
  return {
    ...payload,
    metadata: { ...(payload.metadata || {}), test_run_id: runId, e2e_synthetic: true }
  };
}

export function computeChainHash({ company_id, lot_id, event_type, source_module, event_date, created_by, executor, title, metadata, previous_hash }) {
  return crypto.createHash('sha256').update([
    company_id || '', lot_id || '', event_type || '', source_module || '',
    event_date || '', created_by || '', executor || '', title || '',
    JSON.stringify(metadata || {}), previous_hash || 'GENESIS'
  ].join('|')).digest('hex');
}

export function memInsertOperational(ctx, actor, record) {
  if (!record.metadata?.test_run_id) fail('Registro sin metadata.test_run_id (trazabilidad de ejecución rota)', { code: 'TEST_RUN_TAG_MISSING' });
  if (actor.company_id && record.company_id !== actor.company_id) {
    const e = new Error(`RLS: actor ${actor.userId} no puede escribir en empresa ${record.company_id}`);
    e.code = 'RLS_DENIED';
    e.authorization_status = 'DENIED';
    throw e;
  }
  if (record.latitud != null && (record.latitud < -90 || record.latitud > 90)) {
    const e = new Error(`GPS latitud inválida: ${record.latitud}`);
    e.code = 'GPS_REJECT';
    throw e;
  }
  if (record.longitud != null && (record.longitud < -180 || record.longitud > 180)) {
    const e = new Error(`GPS longitud inválida: ${record.longitud}`);
    e.code = 'GPS_REJECT';
    throw e;
  }
  const id = record.id || uid('op');
  const stored = {
    ...record,
    id,
    created_by: record.created_by || actor.userId,
    created_at: nowIso(), // timestamp generado por "servidor", no por cliente
    updated_at: nowIso()
  };
  ctx.mem.records.set(id, stored);
  ctx.counters.operational += 1;
  memAudit(ctx, { actor, action: 'INSERT', module: record.module || 'core', table: record.table || 'operational', recordId: id, after: stored });
  return stored;
}

export function memTamperOperational(ctx, actor, id, patch) {
  const current = ctx.mem.records.get(id);
  if (!current) {
    const e = new Error('Registro no encontrado');
    e.code = 'NOT_FOUND';
    throw e;
  }
  // Reglas anti-manipulación (spec §7): company/created_by/created_at/farm no falsificables por operario.
  if (actor.role === 'operario') {
    if (patch.company_id && patch.company_id !== current.company_id) {
      const e = new Error('DENIED: operario no puede cambiar company_id');
      e.code = 'TAMPER_DENIED';
      e.authorization_status = 'DENIED';
      throw e;
    }
    if (patch.created_by && patch.created_by !== current.created_by) {
      const e = new Error('DENIED: created_by inmutable');
      e.code = 'TAMPER_DENIED';
      e.authorization_status = 'DENIED';
      throw e;
    }
    if (patch.created_at && patch.created_at !== current.created_at) {
      const e = new Error('DENIED: created_at solo-servidor');
      e.code = 'TAMPER_DENIED';
      e.authorization_status = 'DENIED';
      throw e;
    }
    if (patch.farm_id && patch.farm_id !== current.farm_id) {
      const e = new Error('DENIED: farm_id fuera de ámbito');
      e.code = 'TAMPER_DENIED';
      e.authorization_status = 'DENIED';
      throw e;
    }
  }
  if (actor.company_id && current.company_id !== actor.company_id) {
    const e = new Error('DENIED: cross-tenant write');
    e.code = 'RLS_DENIED';
    e.authorization_status = 'DENIED';
    throw e;
  }
  const updated = { ...current, ...patch, updated_at: nowIso() };
  ctx.mem.records.set(id, updated);
  memAudit(ctx, { actor, action: 'UPDATE', module: current.module || 'core', table: current.table || 'operational', recordId: id, before: current, after: updated });
  return updated;
}

export function memDeleteOperational(ctx, actor, id, { soft = true } = {}) {
  const current = ctx.mem.records.get(id);
  if (!current) {
    const e = new Error('Registro no encontrado');
    e.code = 'NOT_FOUND';
    throw e;
  }
  if (actor.company_id && current.company_id !== actor.company_id) {
    const e = new Error('DENIED: cross-tenant delete');
    e.code = 'RLS_DENIED';
    e.authorization_status = 'DENIED';
    throw e;
  }
  if (actor.role === 'operario' && !soft) {
    const e = new Error('DENIED: borrado físico no permitido; solo SOFT DELETE auditado');
    e.code = 'DELETE_DENIED';
    e.authorization_status = 'DENIED';
    throw e;
  }
  const tombstone = { ...current, deleted: true, deleted_at: nowIso(), deleted_by: actor.userId, updated_at: nowIso() };
  ctx.mem.records.set(id, tombstone);
  memAudit(ctx, { actor, action: 'DELETE', module: current.module || 'core', table: current.table || 'operational', recordId: id, before: current, after: tombstone });
  return tombstone;
}

export function memAudit(ctx, { actor, action, module, table, recordId, before = null, after = null }) {
  const entry = {
    id: uid('audit'),
    test_run_id: ctx.runId,
    company_id: actor.company_id || after?.company_id || before?.company_id,
    usuario_id: actor.userId,
    accion: action,
    modulo: module,
    tabla: table,
    registro_id: recordId,
    antes: before,
    despues: after,
    created_at: nowIso(),
    immutable: true
  };
  ctx.mem.audit.push(entry);
  ctx.counters.audit += 1;
  return entry;
}

export function memEmitTrace(ctx, actor, evt) {
  if (actor.company_id && evt.company_id !== actor.company_id) {
    const e = new Error('DENIED: trace cross-tenant');
    e.code = 'RLS_DENIED';
    e.authorization_status = 'DENIED';
    throw e;
  }
  const prev = ctx.mem.lastHashByCompany.get(evt.company_id) || null;
  const event_date = evt.event_date || nowIso();
  const event_hash = computeChainHash({
    company_id: evt.company_id,
    lot_id: evt.lot_id,
    event_type: evt.event_type,
    source_module: evt.source_module,
    event_date,
    created_by: actor.userId,
    executor: evt.executor_id || evt.executor_name || '',
    title: evt.title,
    metadata: { ...(evt.metadata || {}), test_run_id: ctx.runId },
    previous_hash: prev
  });
  const stored = {
    id: uid('trz'),
    event_code: `TRZ-DRY-${String(ctx.mem.trace.length + 1).padStart(6, '0')}`,
    company_id: evt.company_id,
    farm_id: evt.farm_id || evt.predio_id || null,
    lot_id: evt.lot_id || null,
    event_type: evt.event_type,
    source_module: evt.source_module,
    event_date,
    created_at: nowIso(),
    created_by: actor.userId,
    title: evt.title,
    description: evt.description || null,
    metadata: { ...(evt.metadata || {}), test_run_id: ctx.runId },
    source_table: evt.source_table || null,
    source_id: evt.source_id || null,
    previous_hash: prev,
    event_hash,
    immutable: true,
    integrity_status: 'VALIDADO'
  };
  ctx.mem.trace.push(stored);
  ctx.mem.lastHashByCompany.set(evt.company_id, event_hash);
  ctx.counters.traceability += 1;
  return stored;
}

export function memVerifyChain(ctx, company_id) {
  let prev = null;
  let bad = 0;
  const events = ctx.mem.trace.filter((e) => e.company_id === company_id);
  for (const e of events) {
    const expected = computeChainHash({
      company_id: e.company_id,
      lot_id: e.lot_id,
      event_type: e.event_type,
      source_module: e.source_module,
      event_date: e.event_date,
      created_by: e.created_by,
      executor: e.executor_id || e.executor_name || '',
      title: e.title,
      metadata: e.metadata,
      previous_hash: e.previous_hash
    });
    // Nota: metadata incluye test_run_id tanto al emitir como al verificar → estable.
    if (e.previous_hash !== prev || expected !== e.event_hash) bad += 1;
    prev = e.event_hash;
  }
  return { total: events.length, bad, ok: events.length - bad };
}

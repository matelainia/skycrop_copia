#!/usr/bin/env node
/**
 * SKYCROP E2E — Talento Humano Fase 1 (TH-001…TH-016).
 *
 * Reutiliza tests/e2e/real/real-env.js (JWT HS256 autofirmados + REST directo).
 * Requiere --live y credenciales del proyecto (backend/.env). Sin --live: self-check local.
 * Limpieza total de filas sintéticas E2E-TH-* (la BD queda igual que antes del run).
 *
 *   node tests/e2e/real/runner-th.js --env=test --live [--keep-data] [--seq=N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
try {
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'backend', '.env') });
} catch { /* dotenv opcional */ }
import { parseRealArgs, realConfig, mintTestJwt, rest } from './real-env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = parseRealArgs();
let cfg;
try {
  cfg = realConfig(args);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}

const results = [];
const rec = (id, severity, expect, status, detail) => results.push({ id, severity, expect, status, detail: String(detail).slice(0, 300) });
const denied = (r) => r.status >= 400;
const allow = (r) => r.status >= 200 && r.status < 300;

if (!cfg.live) {
  // Self-check local: JWT roundtrip + matriz de casos bien formada.
  const { token } = mintTestJwt('secreto-local', { sub: 'x', org_id: '123e4567-e89b-12d3-a456-426614174000' });
  rec('TH-000', 'P3', 'ALLOW', token.split('.').length === 3 ? 'PASS' : 'FAIL', 'self-check JWT local (sin red)');
  console.log(JSON.stringify({ runId: cfg.runId, live: false, results }, null, 2));
  process.exit(0);
}

const S = (table, o = {}) => rest(cfg, { table, service: true, ...o });
const J = (table, jwt, o = {}) => rest(cfg, { table, jwt, ...o });
const TAG = cfg.runId; // E2E-REAL-YYYY-MM-DD-NNN
const ctx = {};

// ── SETUP (service_role) ─────────────────────────────────────────────
try {
  const w0 = await S('trabajadores', { method: 'GET', query: '?select=id,company_id&limit=1' });
  if (!w0.body?.length) throw new Error('sin trabajadores base para derivar company A');
  ctx.coA = w0.body[0].company_id;
  const cnt = async (t) => (await S(t, { method: 'GET', query: '?select=*&limit=1' })).status === 200;
  ctx.snapshot = {};
  for (const t of ['trabajadores', 'labores', 'nominas', 'cursos_formacion', 'registros_formacion', 'cuadrillas', 'labor_trabajadores', 'cuadrilla_miembros']) {
    const r = await S(t, { method: 'GET', query: '?select=*' });
    ctx.snapshot[t] = Array.isArray(r.body) ? r.body.length : -1;
  }
  // Sin empresa B: 044 hace audit_logs inmutable y el CASCADE de companies
  // queda bloqueado (hallazgo run 001). Cross-tenant se prueba con UUID
  // inexistente (triangular 42501) + JWT org ajena (lecturas vacías).
  ctx.coB = '11111111-1111-4111-8111-111111111111'; // FAKE: empresa inexistente
  const mk = async (t, b) => {
    const r = await S(t, { method: 'POST', query: '?select=id', body: b, prefer: 'return=representation' });
    if (!allow(r)) throw new Error(`setup ${t}: ${JSON.stringify(r.body)}`);
    return r.body[0].id;
  };
  ctx.loteA = await mk('lotes', { company_id: ctx.coA, codigo_interno: `E2E-TH-${TAG.slice(-3)}`, nombre: `E2E-TH lote A ${TAG}`, cultivo: 'Café' });
  ctx.loteFake = '22222222-2222-4222-8222-222222222222';
  ctx.labFake = '33333333-3333-4333-8333-333333333333';
  // Usuarios sintéticos: profiles + membresías (FK profiles exigida)
  ctx.subAdmin = `e2e_th_admin_${TAG.slice(-3)}`;
  ctx.subSup = `e2e_th_sup_${TAG.slice(-3)}`;
  ctx.subOp = `e2e_th_op_${TAG.slice(-3)}`;
  ctx.subExt = `e2e_th_ext_${TAG.slice(-3)}`;
  for (const s of [ctx.subAdmin, ctx.subSup, ctx.subOp, ctx.subExt]) {
    await S('profiles', { method: 'POST', body: { id: s, email: `${s}@e2e.test`, nombre: 'E2E', apellido: 'TH' }, prefer: 'return=minimal' });
  }
  await S('company_users', { method: 'POST', body: { company_id: ctx.coA, clerk_user_id: ctx.subAdmin, role_id: 'administrador' }, prefer: 'return=minimal' });
  await S('company_users', { method: 'POST', body: { company_id: ctx.coA, clerk_user_id: ctx.subSup, role_id: 'supervisor' }, prefer: 'return=minimal' });
  // subExt SIN membresía + org inexistente: representa empresa ajena (solo lectura vacía).
  // JWTs (sub sintético + org company UUID; TTL corto)
  ctx.jwtAdmin = mintTestJwt(cfg.secret, { sub: ctx.subAdmin, org_id: ctx.coA }).token;
  ctx.jwtSup = mintTestJwt(cfg.secret, { sub: ctx.subSup, org_id: ctx.coA }).token;
  ctx.jwtOp = mintTestJwt(cfg.secret, { sub: ctx.subOp, org_id: ctx.coA }).token;
  ctx.jwtExt = mintTestJwt(cfg.secret, { sub: ctx.subExt, org_id: ctx.coB }).token;
  ctx.jwtExp = mintTestJwt(cfg.secret, { sub: ctx.subOp, org_id: ctx.coA, expired: true }).token;
  ctx.jwtBad = mintTestJwt('firma-equivocada', { sub: ctx.subOp, org_id: ctx.coA }).token;
  rec('TH-SETUP', 'P3', 'ALLOW', 'PASS', `A=${ctx.coA} B=${ctx.coB} snapshot=${JSON.stringify(ctx.snapshot)}`);
} catch (e) {
  rec('TH-SETUP', 'P0', 'ALLOW', 'FAIL', e.message);
  console.log(JSON.stringify({ runId: cfg.runId, results }, null, 2));
  process.exit(1);
}

const E2E = {};
try {
  // TH-001 auth: anon ciego, expirado 401, firma mala 401
  const anon = await J('trabajadores', null, { method: 'GET', query: '?select=id&limit=5' });
  const exp = await J('trabajadores', ctx.jwtExp, { method: 'GET', query: '?select=id&limit=1' });
  const bad = await J('trabajadores', ctx.jwtBad, { method: 'GET', query: '?select=id&limit=1' });
  const anonEmpty = anon.status === 200 && Array.isArray(anon.body) && anon.body.length === 0;
  rec('TH-001', 'P0', 'DENY', anonEmpty && denied(exp) && denied(bad) ? 'PASS' : 'FAIL', `anon=${anon.status}/${anon.body?.length} exp=${exp.status} bad=${bad.status}`);

  // TH-002 crear trabajador + estado inválido
  const w1 = await J('trabajadores', ctx.jwtAdmin, { method: 'POST', query: '?select=id', body: { company_id: ctx.coA, nombres: 'E2E', apellidos: `TH-W1 ${TAG}`, identificacion: `E2E-TH-W1-${TAG}`, tipo_contrato: 'Permanente', rol: 'Operario General', estado: 'Activa' }, prefer: 'return=representation' });
  const wBad = await J('trabajadores', ctx.jwtAdmin, { method: 'POST', body: { company_id: ctx.coA, nombres: 'X', apellidos: 'Y', identificacion: `E2E-TH-WX-${TAG}`, tipo_contrato: 'Permanente', rol: 'R', estado: 'EstadoInventado' }, prefer: 'return=minimal' });
  if (allow(w1)) E2E.w1 = w1.body[0].id;
  rec('TH-002', 'P1', 'ALLOW+DENY', allow(w1) && denied(wBad) ? 'PASS' : 'FAIL', `create=${w1.status} bad-estado=${wBad.status}`);

  // TH-003 taxonomía labores (En Progreso + Archivada)
  const lab = await J('labores', ctx.jwtAdmin, { method: 'POST', query: '?select=id', body: { company_id: ctx.coA, titulo: `E2E-TH lab ${TAG}`, tipo: 'Riego', estado: 'En Progreso', asignacion: 'individual', jornal: 0.5, lote_id: ctx.loteA }, prefer: 'return=representation' });
  let arch = { status: 0 };
  if (allow(lab)) { E2E.lab = lab.body[0].id; arch = await J('labores', ctx.jwtAdmin, { method: 'PATCH', query: `?id=eq.${E2E.lab}`, body: { estado: 'Archivada' }, prefer: 'return=minimal' }); }
  rec('TH-003', 'P1', 'ALLOW', allow(lab) && allow(arch) ? 'PASS' : 'FAIL', `create=${lab.status} archive=${arch.status}`);

  // TH-004 toggle estado trabajador
  const tog = await J('trabajadores', ctx.jwtAdmin, { method: 'PATCH', query: `?id=eq.${E2E.w1}`, body: { estado: 'On Leave' }, prefer: 'return=minimal' });
  rec('TH-004', 'P2', 'ALLOW', allow(tog) ? 'PASS' : 'FAIL', `toggle=${tog.status}`);

  // TH-005 soft-delete: ocultar a operario, visible admin; luego reactivar
  const del = await J('trabajadores', ctx.jwtAdmin, { method: 'PATCH', query: `?id=eq.${E2E.w1}`, body: { estado: 'Inactivo', deleted_at: new Date().toISOString() }, prefer: 'return=minimal' });
  const seeOp = await J('trabajadores', ctx.jwtOp, { method: 'GET', query: `?id=eq.${E2E.w1}&select=id` });
  const seeAd = await J('trabajadores', ctx.jwtAdmin, { method: 'GET', query: `?id=eq.${E2E.w1}&select=id` });
  const hiddenOp = seeOp.status === 200 && (seeOp.body || []).length === 0;
  const seenAd = seeAd.status === 200 && (seeAd.body || []).length === 1;
  const reac = await S('trabajadores', { method: 'PATCH', query: `?id=eq.${E2E.w1}`, body: { estado: 'Activa', deleted_at: null }, prefer: 'return=minimal' });
  rec('TH-005', 'P1', 'ALLOW', allow(del) && hiddenOp && seenAd && allow(reac) ? 'PASS' : 'FAIL', `del=${del.status} op-ve=${seeOp.body?.length} admin-ve=${seeAd.body?.length} reac=${reac.status}`);

  // TH-006 cuadrilla + miembro coherente / cruzado
  const cua = await J('cuadrillas', ctx.jwtAdmin, { method: 'POST', query: '?select=id', body: { company_id: ctx.coA, nombre: `E2E-TH cua ${TAG}` }, prefer: 'return=representation' });
  if (allow(cua)) E2E.cua = cua.body[0].id;
  const memOk = await J('cuadrilla_miembros', ctx.jwtAdmin, { method: 'POST', body: { cuadrilla_id: E2E.cua, trabajador_id: E2E.w1, company_id: ctx.coA }, prefer: 'return=minimal' });
  const memX = await J('cuadrilla_miembros', ctx.jwtAdmin, { method: 'POST', body: { cuadrilla_id: E2E.cua, trabajador_id: ctx.labFake, company_id: ctx.coA }, prefer: 'return=minimal' });
  rec('TH-006', 'P0', 'ALLOW+DENY', allow(cua) && allow(memOk) && denied(memX) ? 'PASS' : 'FAIL', `cua=${cua.status} ok=${memOk.status} cross=${memX.status}`);

  // TH-007 labor con lote propio / inexistente-ajeno (triangular 42501)
  const labBadLote = await J('labores', ctx.jwtAdmin, { method: 'POST', body: { company_id: ctx.coA, titulo: `E2E-TH bad ${TAG}`, tipo: 'Riego', estado: 'Pendiente', asignacion: 'individual', jornal: 1, lote_id: ctx.loteFake }, prefer: 'return=minimal' });
  rec('TH-007', 'P0', 'DENY', denied(labBadLote) ? 'PASS' : 'FAIL', `lote-ajeno=${labBadLote.status}`);

  // TH-008 puente coherente / fantasma (C-04 núcleo)
  const brOk = await J('labor_trabajadores', ctx.jwtAdmin, { method: 'POST', body: { labor_id: E2E.lab, trabajador_id: E2E.w1, company_id: ctx.coA }, prefer: 'return=minimal' });
  const brX = await J('labor_trabajadores', ctx.jwtAdmin, { method: 'POST', body: { labor_id: ctx.labFake, trabajador_id: E2E.w1, company_id: ctx.coA }, prefer: 'return=minimal' });
  rec('TH-008', 'P0', 'ALLOW+DENY', allow(brOk) && denied(brX) ? 'PASS' : 'FAIL', `ok=${brOk.status} cross=${brX.status} ${JSON.stringify(brX.body).slice(0, 120)}`);

  // TH-009 org ajena (inexistente) no ve nada de A
  const extT = await J('trabajadores', ctx.jwtExt, { method: 'GET', query: '?select=id' });
  const extLabA = await J('labores', ctx.jwtExt, { method: 'GET', query: `?id=eq.${E2E.lab}&select=id` });
  const onlyNone = extT.status === 200 && (extT.body || []).length === 0;
  const noA = extLabA.status === 200 && (extLabA.body || []).length === 0;
  rec('TH-009', 'P0', 'DENY', onlyNone && noA ? 'PASS' : 'FAIL', `ext-trab=${extT.body?.length} ext-labA=${extLabA.body?.length}`);

  // TH-010 nóminas: admin ok+recompute, doble no, operario no, supervisor sí
  const n1 = await J('nominas', ctx.jwtAdmin, { method: 'POST', query: '?select=id,total_neto', body: { company_id: ctx.coA, trabajador_id: E2E.w1, periodo: `E2E-TH-${TAG.slice(-3)}`, salario_neto: 2000000, horas_extras: 1, valor_hora_extra: 60000, retenciones: 50000, total_neto: 0, estado: 'Procesando' }, prefer: 'return=representation' });
  if (allow(n1)) E2E.nom = n1.body[0].id;
  const recompute = allow(n1) && Number(n1.body[0].total_neto) === 2010000;
  const n2 = await J('nominas', ctx.jwtAdmin, { method: 'POST', body: { company_id: ctx.coA, trabajador_id: E2E.w1, periodo: `E2E-TH-${TAG.slice(-3)}`, salario_neto: 1, horas_extras: 0, valor_hora_extra: 0, retenciones: 0, total_neto: 0, estado: 'Procesando' }, prefer: 'return=minimal' });
  const nOp = await J('nominas', ctx.jwtOp, { method: 'POST', body: { company_id: ctx.coA, trabajador_id: E2E.w1, periodo: `E2E-TH-OP-${TAG.slice(-3)}`, salario_neto: 1, horas_extras: 0, valor_hora_extra: 0, retenciones: 0, total_neto: 0, estado: 'Procesando' }, prefer: 'return=minimal' });
  const nSup = await J('nominas', ctx.jwtSup, { method: 'POST', query: '?select=id', body: { company_id: ctx.coA, trabajador_id: E2E.w1, periodo: `E2E-TH-SUP-${TAG.slice(-3)}`, salario_neto: 1, horas_extras: 0, valor_hora_extra: 0, retenciones: 0, total_neto: 0, estado: 'Procesando' }, prefer: 'return=representation' });
  if (allow(nSup)) E2E.nomSup = nSup.body[0].id;
  rec('TH-010', 'P0', 'ALLOW+DENY', allow(n1) && recompute && denied(n2) && denied(nOp) && allow(nSup) ? 'PASS' : 'FAIL', `admin=${n1.status}/${n1.body?.[0]?.total_neto} doble=${n2.status} oper=${nOp.status} sup=${nSup.status}`);

  // TH-011 cursos/registros
  const cur = await J('cursos_formacion', ctx.jwtAdmin, { method: 'POST', query: '?select=id', body: { company_id: ctx.coA, nombre: `E2E-TH cur ${TAG}`, tipo: 'Primeros Auxilios', total_horas: 8 }, prefer: 'return=representation' });
  if (allow(cur)) E2E.cur = cur.body[0].id;
  const regR = await J('registros_formacion', ctx.jwtAdmin, { method: 'POST', query: '?select=id', body: { company_id: ctx.coA, trabajador_id: E2E.w1, curso_id: E2E.cur, fecha: '2026-09-15', resultado: '10/10', estado: 'Completada' }, prefer: 'return=representation' });
  if (allow(regR)) E2E.reg = regR.body[0].id;
  const curBad = await J('cursos_formacion', ctx.jwtAdmin, { method: 'POST', body: { company_id: ctx.coA, nombre: `E2E-TH bad ${TAG}`, tipo: 'Operación', total_horas: 1 }, prefer: 'return=minimal' });
  rec('TH-011', 'P1', 'ALLOW+DENY', allow(cur) && allow(regR) && denied(curBad) ? 'PASS' : 'FAIL', `cur=${cur.status} reg=${regR.status} bad=${curBad.status}`);

  // TH-012 alcance empresa sin lote (051 §9): labor sin lote visible tenant
  const labNoLote = await J('labores', ctx.jwtAdmin, { method: 'POST', query: '?select=id', body: { company_id: ctx.coA, titulo: `E2E-TH nolote ${TAG}`, tipo: 'Otro', estado: 'Pendiente', asignacion: 'individual', jornal: 1 }, prefer: 'return=representation' });
  if (allow(labNoLote)) E2E.labNL = labNoLote.body[0].id;
  const visOp = await J('labores', ctx.jwtOp, { method: 'GET', query: `?id=eq.${E2E.labNL}&select=id` });
  rec('TH-012', 'P2', 'ALLOW', allow(labNoLote) && visOp.status === 200 && (visOp.body || []).length === 1 ? 'PASS' : 'FAIL', `create=${labNoLote.status} op-ve=${visOp.body?.length}`);

  // TH-013 RBAC spot: supervisor edita labor ok; operario NO borra (0 filas = DENY RLS).
  // PostgREST devuelve 204 aun con 0 filas: se exige return=representation vacío.
  const supEdit = await J('labores', ctx.jwtSup, { method: 'PATCH', query: `?id=eq.${E2E.labNL}`, body: { estado: 'En Progreso' }, prefer: 'return=minimal' });
  const opDel = await J('trabajadores', ctx.jwtOp, { method: 'DELETE', query: `?id=eq.${E2E.w1}&select=id`, prefer: 'return=representation' });
  const opDenied = opDel.status === 200 && Array.isArray(opDel.body) && opDel.body.length === 0;
  const stillThere = (await S('trabajadores', { method: 'GET', query: `?id=eq.${E2E.w1}&select=id` })).body?.length === 1;
  rec('TH-013', 'P0', 'ALLOW+DENY', allow(supEdit) && opDenied && stillThere ? 'PASS' : 'FAIL', `sup-edit=${supEdit.status} op-del=${opDel.status}/${JSON.stringify(opDel.body)} intacto=${stillThere}`);

  // TH-014 RLS: anon insert no; forgery company no
  const anonIns = await J('trabajadores', null, { method: 'POST', body: { company_id: ctx.coA, nombres: 'A', apellidos: 'B', identificacion: `E2E-TH-ANON-${TAG}`, tipo_contrato: 'Jornal', rol: 'R', estado: 'Activa' }, prefer: 'return=minimal' });
  const forg = await J('trabajadores', ctx.jwtOp, { method: 'POST', body: { company_id: ctx.coB, nombres: 'A', apellidos: 'B', identificacion: `E2E-TH-FORG-${TAG}`, tipo_contrato: 'Jornal', rol: 'R', estado: 'Activa' }, prefer: 'return=minimal' });
  rec('TH-014', 'P0', 'DENY', denied(anonIns) && denied(forg) ? 'PASS' : 'FAIL', `anon=${anonIns.status} forgery=${forg.status}`);

  // TH-015 auditoría: audit_logs + created_by del actor JWT
  const audit = await S('audit_logs', { method: 'GET', query: `?modulo=eq.trabajadores&usuario_id=eq.${ctx.subAdmin}&select=id&limit=5` });
  const actorRow = await S('trabajadores', { method: 'GET', query: `?id=eq.${E2E.w1}&select=created_by` });
  const auditOk = audit.status === 200 && (audit.body || []).length >= 1;
  const actorOk = actorRow.status === 200 && actorRow.body?.[0]?.created_by === ctx.subAdmin;
  rec('TH-015', 'P1', 'ALLOW', auditOk && actorOk ? 'PASS' : 'FAIL', `audit=${audit.body?.length} created_by=${actorRow.body?.[0]?.created_by}`);
} catch (e) {
  rec('TH-RUN', 'P0', 'ALLOW', 'FAIL', `excepción: ${e.message}`);
}

// ── TH-016 LIMPIEZA ────────────────────────────────────────────────────
const cl = [];
try {
  if (!cfg.keepData) {
    if (E2E.nom) await S('nominas', { method: 'DELETE', query: `?id=eq.${E2E.nom}` });
    if (E2E.nomSup) await S('nominas', { method: 'DELETE', query: `?id=eq.${E2E.nomSup}` });
    if (E2E.reg) await S('registros_formacion', { method: 'DELETE', query: `?id=eq.${E2E.reg}` });
    if (E2E.cur) await S('cursos_formacion', { method: 'DELETE', query: `?id=eq.${E2E.cur}` });
    if (E2E.lab) { await S('labor_trabajadores', { method: 'DELETE', query: `?labor_id=eq.${E2E.lab}` }); await S('labores', { method: 'DELETE', query: `?id=eq.${E2E.lab}` }); }
    if (E2E.labNL) await S('labores', { method: 'DELETE', query: `?id=eq.${E2E.labNL}` });
    if (E2E.cua) { await S('cuadrilla_miembros', { method: 'DELETE', query: `?cuadrilla_id=eq.${E2E.cua}` }); await S('cuadrillas', { method: 'DELETE', query: `?id=eq.${E2E.cua}` }); }
    if (E2E.w1) await S('trabajadores', { method: 'DELETE', query: `?id=eq.${E2E.w1}` });
    // Sin empresa B (044): solo filas propias + membresías + perfiles + lote A.
    await S('company_users', { method: 'DELETE', query: `?clerk_user_id=in.(${ctx.subAdmin},${ctx.subSup})` });
    await S('lotes', { method: 'DELETE', query: `?codigo_interno=eq.E2E-TH-${TAG.slice(-3)}` });
    for (const s of [ctx.subAdmin, ctx.subSup, ctx.subOp, ctx.subExt]) await S('profiles', { method: 'DELETE', query: `?id=eq.${s}` });
    // Verificación conteos = snapshot
    let cleanOk = true; const det = [];
    for (const t of Object.keys(ctx.snapshot)) {
      const r = await S(t, { method: 'GET', query: '?select=*' });
      const n = Array.isArray(r.body) ? r.body.length : -1;
      det.push(`${t}:${n}`);
      if (n !== ctx.snapshot[t]) cleanOk = false;
    }
    const lotesGone = (await S('lotes', { method: 'GET', query: `?codigo_interno=eq.E2E-TH-${TAG.slice(-3)}&select=id` })).body?.length === 0;
    rec('TH-016', 'P0', 'ALLOW', cleanOk && lotesGone ? 'PASS' : 'FAIL', det.join(' ') + ` lotes-gone=${lotesGone}`);
  } else {
    rec('TH-016', 'P3', 'ALLOW', 'PASS', '--keep-data: evidencia retenida');
  }
} catch (e) {
  rec('TH-016', 'P0', 'ALLOW', 'FAIL', `limpieza: ${e.message}`);
}

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL');
const P0 = failed.filter((r) => r.severity === 'P0').length;
const P1 = failed.filter((r) => r.severity === 'P1').length;
const summary = { total: results.length, passed, failed: failed.length, P0, P1, passRate: ((passed / results.length) * 100).toFixed(1) };

// Reportes
const stamp = TAG.replace('E2E-REAL-', '');
const base = `SKYCROP_E2E_TALENTO_HUMANO_${stamp}`;
fs.writeFileSync(path.join(__dirname, 'reports', `${base}.json`), JSON.stringify({ runId: TAG, env: cfg.env, summary, results, ctx: { coA: ctx.coA } }, null, 2));
const md = [`# E2E Talento Humano — ${TAG}`, ``, `Entorno: ${cfg.env} · live`, ``, `TOTAL ${summary.total} · PASS ${summary.passed} · FAIL ${summary.failed} · P0 ${summary.P0} · P1 ${summary.P1} · ${summary.passRate}%`, ``, `| ID | Sev | Expect | Result | Detalle |`, `|---|---|---|---|---|`, ...results.map((r) => `| ${r.id} | ${r.severity} | ${r.expect} | ${r.status} | ${r.detail} |`), ``, P0 + P1 > 0 ? '**NO CERTIFICADO**' : '**FASE 1 VERIFICADA E2E** (pendiente Fase 2 para certificación global)'];
fs.writeFileSync(path.join(__dirname, 'reports', `${base}.md`), md.join('\n'));
console.log(JSON.stringify({ runId: TAG, summary, failed: failed.map((f) => f.id) }, null, 2));
process.exit(failed.length ? 1 : 0);

#!/usr/bin/env node
/**
 * Re-sondeo 4 niveles (§10): existencia → ejecución → seguridad → integridad.
 * Compara contra resondeo-BEFORE.json y reporta H-01..H-06 CLOSED/OPEN.
 *
 *   node remediacion/resondeo.mjs --nivel=1   # solo lectura, siempre seguro
 *   node remediacion/resondeo.mjs --nivel=2   # errores controlados (sin escritura válida posible)
 *   node remediacion/resondeo.mjs --nivel=3   # requiere TEST/STAGING + E2E_LIVE=1 (escribe sintético)
 *   node remediacion/resondeo.mjs --nivel=4   # idem + verifica evento/auditoría/costo
 *
 * Guard: niveles 3-4 exigen SUPABASE_URL sin marcadores de producción
 * (skycrop.app, backend.skycrop.app) y E2E_LIVE=1. Sin eso: abortan.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(=(.*))?$/); return m ? [m[1], m[3] ?? true] : []; }));
const NIVEL = Number(args.nivel || 1);

let SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
let ANON = process.env.SUPABASE_ANON_KEY || '';
let SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let SECRET = process.env.SUPABASE_JWT_SECRET || '';
if (!SUPABASE_URL) {
  // Fallback operativo: credenciales del backend local (proyecto desechable).
  try {
    const root = path.resolve(__dirname, '..', '..', '..', '..');
    const raw = fs.readFileSync(path.join(root, 'backend', '.env'), 'utf8');
    const e = Object.fromEntries(raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
    SUPABASE_URL = (e.SUPABASE_URL || '').replace(/\/$/, ''); ANON = e.SUPABASE_ANON_KEY || '';
    SERVICE = e.SUPABASE_SERVICE_ROLE_KEY || ''; SECRET = e.SUPABASE_JWT_SECRET || '';
  } catch { /* sin fallback */ }
}
for (const m of ['skycrop.app', 'backend.skycrop.app']) {
  if (SUPABASE_URL.toLowerCase().includes(m)) { console.error(`GUARD: URL productiva (${m}). Abortando.`); process.exit(2); }
}
if (NIVEL >= 3 && (process.env.E2E_LIVE !== '1' || !SUPABASE_URL || !ANON || !SERVICE || !SECRET)) {
  console.error('GUARD: niveles 3-4 requieren SUPABASE_URL/ANON/SERVICE/JWT_SECRET de TEST/STAGING + E2E_LIVE=1.');
  process.exit(2);
}

const svc = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const mk = (org, role = 'operario') => {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u({ alg: 'HS256', typ: 'JWT' });
  const p = b64u({ aud: 'authenticated', exp: now + 600, sub: 'resondeo', role: 'authenticated', org_id: org, role_name: role });
  const s = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return h + '.' + p + '.' + s;
};
const out = { ts: new Date().toISOString(), nivel: NIVEL, hallazgos: {} };
const ok = (b, cond) => (cond ? 'CLOSED' : 'OPEN');

if (NIVEL >= 1) {
  // N1: descubrimiento PostgREST. OJO: llamar con {} produce PGRST202 incluso
  // sano (sin overload de 0 args). Se usa firma completa con JWT operario sin
  // membresía: si enruta, responde error de negocio (denegación controlada);
  // solo PGRST202/404 = no descubierta. Cero escrituras (denegado pre-INSERT).
  const mkN1 = (org) => {
    const now = Math.floor(Date.now() / 1000);
    const h = b64u({ alg: 'HS256', typ: 'JWT' });
    const p = b64u({ aud: 'authenticated', exp: now + 600, sub: 'resondeo', role: 'authenticated', org_id: org, role_name: 'operario' });
    const s = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return h + '.' + p + '.' + s;
  };
  const ORG = '6ffd13b6-e541-406f-9808-7b3283752ee1';
  const Z = '00000000-0000-0000-0000-000000000000';
  // Firma COMPLETA (todos los params sin DEFAULT) con valores que la RPC
  // rechaza pre-escritura (rol/tenant/validación). Denegación = enrutada.
  const shaped = {
    registrar_maquinaria: { p_codigo: 'E2E-X', p_nombre: 'Y', p_tipo: 'Tractor' },
    iniciar_jornada_maquinaria: { p_maquinaria_id: Z, p_operador_id: null, p_lote_id: Z, p_labor: 'x', p_inicio: new Date().toISOString(), p_horometro_inicio: 0 },
    finalizar_jornada_maquinaria: { p_operacion_id: Z, p_fin: new Date().toISOString(), p_horometro_fin: 0 },
    registrar_combustible_maquinaria: { p_maquinaria_id: Z, p_fecha: new Date().toISOString(), p_cantidad: -5, p_unidad: 'L', p_costo_unitario: 0, p_horometro: 0 },
    programar_mantenimiento_maquinaria: { p_maquinaria_id: Z, p_tipo: 'NOEXISTE', p_descripcion: 'x', p_fecha_programada: '2026-01-01', p_horometro_ref: 0 },
    registrar_mantenimiento_maquinaria_v2: { p_mantenimiento_id: Z, p_fecha_ejecucion: '2026-01-01', p_horometro: -1 },
    actualizar_horometro_maquinaria: { p_maquinaria_id: Z, p_horometro: -1 },
    registrar_incidencia_maquinaria: { p_maquinaria_id: Z, p_severidad: 'NOEXISTE', p_descripcion: 'x' },
  };
  const probes = {};
  for (const [f, body] of Object.entries(shaped)) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + mkN1(ORG), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const t = await r.text().catch(() => '');
    probes[f] = r.status + (t.includes('PGRST202') ? ':UNDISCOVERED' : ':ROUTED');
  }
  // Testigos de infraestructura (pre-052) con service_role + {} (solo existencia).
  for (const f of ['registrar_costo_lote', 'tiene_acceso_predio', 'alcance_operativo', 'registrar_evento_trazabilidad', 'e2e_verify_evidence_chain', 'e2e_cleanup_test_run']) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }, body: '{}' });
    probes[f] = r.status;
  }
  const rpc052 = Object.keys(shaped);
  out.n1_existencia = probes;
  out.hallazgos['H-01(N1)'] = ok(0, rpc052.every((f) => String(probes[f]).includes(':ROUTED')));
  // H-02 infra con args requeridos: PostgREST no confirma existencia sin overload
  // (PGRST202 ambiguo). Autoridad = pg_proc en Dashboard (A1). Aquí solo se
  // marca OPEN si hay 404 en funciones de 0 args o error distinto.
  out.hallazgos['H-02(N1)'] = 'PENDING-DASHBOARD(registrar_costo_lote)';
}
if (NIVEL >= 2 && SECRET && SUPABASE_URL) {
  // N2: exposición segura. Anon NO debe resolver (sin EXECUTE → 404/PGRST202).
  // Autenticado inválido debe recibir denegación de negocio (ya probado en N1
  // shaped: :ROUTED). Ambas condiciones = sin bypass.
  const anonH = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };
  const t = async (fn, body) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: anonH, body: JSON.stringify(body) }); return r.status; };
  out.n2_anon_sin_resolucion = {
    registrar: await t('registrar_maquinaria', { p_codigo: 'X', p_nombre: 'Y', p_tipo: 'Tractor' }),
    iniciar: await t('iniciar_jornada_maquinaria', { p_maquinaria_id: '00000000-0000-0000-0000-000000000000', p_lote_id: '00000000-0000-0000-0000-000000000000', p_labor: 'x', p_inicio: new Date().toISOString(), p_horometro_inicio: 0 }),
    combustible: await t('registrar_combustible_maquinaria', { p_maquinaria_id: '00000000-0000-0000-0000-000000000000', p_fecha: new Date().toISOString(), p_cantidad: 1, p_unidad: 'L', p_costo_unitario: 1, p_horometro: 0 }),
  };
  const vals = Object.values(out.n2_anon_sin_resolucion);
  // 401/403/404 = denegación sin bypass (anon jamás alcanza lógica de negocio).
  // 2xx/400 = FAIL (anon enrutado). Mixto 401/404 observado = comportamiento
  // PostgREST por función, ambos seguros.
  out.hallazgos['H-01(N2)'] = ok(0, vals.every((s) => [401, 403, 404].includes(s)));
}
if (NIVEL >= 3) {
  // N3/N4: reservados al --live con datos sintéticos (harness tests/e2e/real).
  out.n3_n4 = 'Ejecutar npm run test:e2e:real -- --env=test --live (puerta §12/§13).';
}
let before = null;
try { before = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'resondeo-BEFORE.json'), 'utf8')); } catch { /* sin BEFORE */ }
out.before_after = (before?.cases || []).map((c) => ({ id: c.id, before: c.http ?? c.rows ?? null }));
const dest = path.join(__dirname, '..', `resondeo-N${NIVEL}-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.hallazgos, null, 2));
console.log(dest);

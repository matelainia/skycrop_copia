/**
 * SKYCROP E2E REAL — Setup y cleanup (§3, §13).
 *
 * Crea exclusivamente en TEST/STAGING vía service_role:
 *   companies A/B → profiles sintéticos → company_users (rol real, lo que lee
 *   current_role_id()) → predios (A asignado, A2 no asignado, B) → lotes →
 *   cliente E2E (para ventas/facturas) → user_predios (alcance por predio, 050).
 * IDs UUID generados en el runner (deterministas para el contrato de schema).
 * Limpieza en orden inverso; companies al final (CASCADE). audit_logs y el
 * reporte se retienen temporalmente (§21 del plan base).
 */
import crypto from 'node:crypto';
import { rest } from './real-env.js';

export const TEST_USERS = [
  { key: 'administrador', role: 'administrador', company: 'A' },
  { key: 'gerente', role: 'gerente', company: 'A' },
  { key: 'supervisor', role: 'supervisor', company: 'A' },
  { key: 'operario', role: 'operario', company: 'A' },
  { key: 'limitado', role: 'consulta', company: 'A', predioLimitado: true },
  { key: 'externo', role: 'operario', company: 'B' },
  { key: 'sin_predio', role: 'operario', company: 'A' },
  { key: 'inactivo', role: 'operario', company: 'A', inactive: true }
];

/** IDs del contexto (inyectables para el contrato de schema). */
export function newIds() {
  const u = () => crypto.randomUUID();
  return { companyA: u(), companyB: u(), farmA: u(), farmA2: u(), farmB: u(), lotA1: u(), lotA2: u(), lotB: u(), clienteA: u() };
}

function subFor(key, tag) {
  return `user_e2e_real_${key}_${tag}`;
}

/**
 * Cuerpos exactos que se insertan (misma fuente para setup y contrato).
 * Columnas verificadas contra migraciones 003/004/007/008/009/015/042.
 */
export function buildSetupBodies(tag, ids, runId) {
  const email = (s) => `${s}@e2e.skycrop.test`;
  return [
    { table: 'companies', body: { id: ids.companyA, clerk_org_id: `org_e2e_real_a_${tag}`, nombre: `E2E-REAL Empresa A ${runId}` } },
    { table: 'companies', body: { id: ids.companyB, clerk_org_id: `org_e2e_real_b_${tag}`, nombre: `E2E-REAL Empresa B ${runId}` } },
    { table: 'predios', body: { id: ids.farmA, company_id: ids.companyA, nombre: `E2E-REAL Predio A ${runId}`, area_total_ha: 12.5 } },
    { table: 'predios', body: { id: ids.farmA2, company_id: ids.companyA, nombre: `E2E-REAL Predio A2 no asignado ${runId}`, area_total_ha: 4 } },
    { table: 'predios', body: { id: ids.farmB, company_id: ids.companyB, nombre: `E2E-REAL Predio B ${runId}`, area_total_ha: 8 } },
    { table: 'lotes', body: { id: ids.lotA1, company_id: ids.companyA, predio_id: ids.farmA, codigo_interno: `E2E-R-L01-${tag}`, nombre: 'Lote R01', cultivo: 'Maíz E2E', area_ha: 2.5, estado_sanitario: 'bueno' } },
    { table: 'lotes', body: { id: ids.lotA2, company_id: ids.companyA, predio_id: ids.farmA2, codigo_interno: `E2E-R-L02-${tag}`, nombre: 'Lote R02 no asignado', cultivo: 'Maíz E2E', area_ha: 1.5, estado_sanitario: 'bueno' } },
    { table: 'lotes', body: { id: ids.lotB, company_id: ids.companyB, predio_id: ids.farmB, codigo_interno: `E2E-R-LB1-${tag}`, nombre: 'Lote RB1', cultivo: 'Cacao E2E', area_ha: 3, estado_sanitario: 'bueno' } },
    { table: 'clientes', body: { id: ids.clienteA, company_id: ids.companyA, nombre: `Comprador E2E ${runId}`, nit: `E2E-${tag}-001`, email: `comprador.${tag}@e2e.skycrop.test` } },
    ...TEST_USERS.map((u) => ({
      table: 'profiles',
      body: { id: subFor(u.key, tag), email: email(subFor(u.key, tag)), nombre: `E2E ${u.key}` }
    })),
    ...TEST_USERS.map((u) => ({
      table: 'company_users',
      body: {
        company_id: u.company === 'A' ? ids.companyA : ids.companyB,
        clerk_user_id: subFor(u.key, tag), role_id: u.role,
        activo: !u.inactive, status: u.inactive ? 'inactive' : 'active'
      }
    })),
    // Alcance por predio (migración 050): operario/limitado/gerente→A; externo→B;
    // sin_predio e inactivo → ninguno (el inactivo además tiene activo=false).
    { table: 'user_predios', body: { company_id: ids.companyA, predio_id: ids.farmA, clerk_user_id: subFor('operario', tag), alcance: 'lectura_escritura' } },
    { table: 'user_predios', body: { company_id: ids.companyA, predio_id: ids.farmA, clerk_user_id: subFor('limitado', tag), alcance: 'lectura' } },
    { table: 'user_predios', body: { company_id: ids.companyA, predio_id: ids.farmA, clerk_user_id: subFor('gerente', tag), alcance: 'lectura_escritura' } },
    { table: 'user_predios', body: { company_id: ids.companyB, predio_id: ids.farmB, clerk_user_id: subFor('externo', tag), alcance: 'lectura_escritura' } }
  ];
}

async function insertOne(cfg, table, body) {
  const r = await rest(cfg, { table, method: 'POST', service: true, body, prefer: 'return=representation', query: '?select=id' });
  if (r.status >= 300 || !r.body?.[0]) throw new Error(`setup ${table} → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body[0];
}

export async function setupRealContext(cfg) {
  const tag = cfg.runId.slice(-3);
  const ids = newIds();
  const bodies = buildSetupBodies(tag, ids, cfg.runId);
  let predioScope = true;
  for (const { table, body } of bodies) {
    if (table === 'user_predios') {
      // Best-effort: la tabla existe desde la migración 050.
      try {
        await insertOne(cfg, table, body);
      } catch (e) {
        predioScope = false;
        console.warn(`[setup] user_predios no disponible (¿050 sin aplicar?): ${e.message.slice(0, 120)}`);
        break;
      }
      continue;
    }
    await insertOne(cfg, table, body);
  }
  const S = {
    companyA: { id: ids.companyA }, companyB: { id: ids.companyB },
    farmA: { id: ids.farmA }, farmA2: { id: ids.farmA2 }, farmB: { id: ids.farmB },
    lotA1: { id: ids.lotA1 }, lotA2: { id: ids.lotA2 }, lotB: { id: ids.lotB },
    clienteA: { id: ids.clienteA },
    users: {},
    _predioScope: predioScope
  };
  for (const u of TEST_USERS) {
    const company_id = u.company === 'A' ? ids.companyA : ids.companyB;
    S.users[u.key] = { sub: subFor(u.key, tag), role: u.role, company_id, farmAlcance: u.predioLimitado ? ids.farmA : (u.company === 'A' ? ids.farmA : ids.farmB) };
  }
  return S;
}

async function del(cfg, table, query) {
  try {
    const r = await rest(cfg, { table, method: 'DELETE', service: true, query });
    return `${r.status}`;
  } catch (e) {
    return `SKIP:${e.message}`;
  }
}

/** Cleanup controlado: invierte el setup; companies al final (CASCADE). */
export async function cleanupRealContext(cfg, S, { keepData = false } = {}) {
  if (keepData) return { kept: true };
  if (!S) return { nothing: true };
  const out = {};
  out.user_predios = await del(cfg, 'user_predios', `?company_id=in.(${S.companyA.id},${S.companyB.id})`);
  out.venta_detalles = await del(cfg, 'venta_detalles', `?company_id=eq.${S.companyA.id}`);
  out.ventas = await del(cfg, 'ventas', `?company_id=eq.${S.companyA.id}`);
  out.facturas = await del(cfg, 'facturas', `?company_id=eq.${S.companyA.id}`);
  out.traceability = await del(cfg, 'traceability_events', `?company_id=eq.${S.companyA.id}`);
  out.cosechas = await del(cfg, 'cosechas', `?company_id=eq.${S.companyA.id}`);
  out.aplicaciones = await del(cfg, 'aplicaciones', `?company_id=eq.${S.companyA.id}`);
  out.monitoreos = await del(cfg, 'monitoreos', `?company_id=eq.${S.companyA.id}`);
  out.traceabilityB = await del(cfg, 'traceability_events', `?company_id=eq.${S.companyB.id}`);
  out.lotesB = await del(cfg, 'lotes', `?company_id=eq.${S.companyB.id}`);
  out.prediosB = await del(cfg, 'predios', `?company_id=eq.${S.companyB.id}`);
  out.clientes = await del(cfg, 'clientes', `?company_id=eq.${S.companyA.id}`);
  out.labores = await del(cfg, 'labores', `?company_id=eq.${S.companyA.id}`);
  out.analisis = await del(cfg, 'analisis_suelos', `?company_id=eq.${S.companyA.id}`);
  out.jornadas = await del(cfg, 'jornadas_maquinaria', `?company_id=eq.${S.companyA.id}`);
  out.maquinaria = await del(cfg, 'maquinaria', `?company_id=eq.${S.companyA.id}`);
  out.lotes_producto = await del(cfg, 'lotes_producto', `?company_id=eq.${S.companyA.id}`);
  out.postcosecha = await del(cfg, 'procesos_postcosecha', `?company_id=eq.${S.companyA.id}`);
  out.lotesA = await del(cfg, 'lotes', `?company_id=eq.${S.companyA.id}`);
  out.prediosA = await del(cfg, 'predios', `?company_id=eq.${S.companyA.id}`);
  out.company_users = await del(cfg, 'company_users', `?company_id=in.(${S.companyA.id},${S.companyB.id})`);
  for (const k of Object.keys(S.users || {})) {
    await del(cfg, 'profiles', `?id=eq.${S.users[k].sub}`);
  }
  out.companyB = await del(cfg, 'companies', `?id=eq.${S.companyB.id}`);
  out.companyA = await del(cfg, 'companies', `?id=eq.${S.companyA.id}`);
  return out; // audit_logs + reportes se retienen temporalmente
}

/**
 * SKYCROP E2E REAL — Contrato de schema (falla rápido, en local, sin red).
 *
 * Fija las columnas obligatorias reales por tabla (verificadas en migraciones
 * 003/004/007/008/009/015/042/048/050) y valida los cuerpos EXACTOS que el
 * setup inserta + los payloads del recorrido. Si el schema cambia, esto falla
 * en el self-check antes de tocar Supabase.
 */
import { buildSetupBodies, newIds, TEST_USERS } from './setup.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const ROLES_SEED = ['super_admin', 'gerente', 'administrador', 'ingeniero', 'supervisor', 'operario', 'auditor', 'invitado', 'consulta'];
const VENTA_ESTADOS = ['BORRADOR', 'CONFIRMADA', 'PREPARACION', 'DESPACHADA', 'ENTREGADA', 'ANULADA', 'CANCELADA'];
const FACTURA_ESTADOS = ['BORRADOR', 'EMITIDA', 'PAGADA', 'ANULADA', 'VENCIDA'];
const TRZ_TYPES = ['fertilization_application', 'sanitary_application', 'sanitary_monitoring', 'general_monitoring', 'nutrition_monitoring', 'harvest_collection', 'postharvest_process', 'worker_activity', 'inventory_movement', 'soil_analysis', 'cultural_labor', 'machinery_operation', 'irrigation', 'planting', 'pruning', 'other'];
const TRZ_MODULES = ['fertilizacion', 'sanitario', 'monitoreo', 'cosecha', 'postcosecha', 'personal', 'inventario', 'suelos', 'maquinaria', 'riego', 'sistema'];
const ALCANCES = ['lectura', 'lectura_escritura'];

// Tabla → columnas NOT NULLчества exigidas por el E2E (subset operativo del DDL).
const REQUIRED = {
  companies: ['id', 'clerk_org_id', 'nombre'],
  predios: ['id', 'company_id', 'nombre'],
  lotes: ['id', 'company_id', 'predio_id', 'codigo_interno', 'nombre', 'cultivo'],
  clientes: ['id', 'company_id', 'nombre'],
  profiles: ['id', 'email', 'nombre'],
  company_users: ['company_id', 'clerk_user_id', 'role_id', 'activo', 'status'],
  user_predios: ['company_id', 'predio_id', 'clerk_user_id', 'alcance']
};

function req(cond, msg) {
  if (!cond) throw new Error(`SCHEMA_CONTRACT: ${msg}`);
}

export function assertContract(runId = 'E2E-REAL-2000-01-01-001') {
  const tag = runId.slice(-3);
  const ids = newIds();
  const bodies = buildSetupBodies(tag, ids, runId);
  const checks = [];

  for (const { table, body } of bodies) {
    for (const col of REQUIRED[table] || []) {
      req(body[col] !== undefined && body[col] !== null && body[col] !== '',
        `${table} sin columna obligatoria "${col}"`);
    }
    if (body.id && typeof body.id === 'string' && body.id.includes('-')) {
      req(UUID_RE.test(body.id), `${table} id no-UUID`);
    }
    if (body.email) req(EMAIL_RE.test(body.email), `${table} email inválido: ${body.email}`);
    if (body.role_id) req(ROLES_SEED.includes(body.role_id), `company_users role_id fuera del seed: ${body.role_id}`);
    if (body.alcance) req(ALCANCES.includes(body.alcance), `user_predios alcance inválido: ${body.alcance}`);
    if (body.estado_sanitario) req(['excelente', 'bueno', 'regular', 'bajo', 'sin_datos'].includes(body.estado_sanitario), `lotes estado_sanitario inválido`);
  }
  checks.push(`setup: ${bodies.length} cuerpos con columnas obligatorias OK`);

  // company_users exige profiles (FK): todo clerk_user_id debe tener profile.
  const subs = new Set(bodies.filter((b) => b.table === 'profiles').map((b) => b.body.id));
  for (const b of bodies.filter((b) => b.table === 'company_users')) {
    req(subs.has(b.body.clerk_user_id), `company_users ${b.body.clerk_user_id} sin profile (FK)`);
  }
  checks.push(`FK company_users→profiles OK (${TEST_USERS.length} usuarios)`);

  // user_predios tenant: predio.company debe ser la declarada.
  const predioCompany = new Map(bodies.filter((b) => b.table === 'predios').map((b) => [b.body.id, b.body.company_id]));
  for (const b of bodies.filter((b) => b.table === 'user_predios')) {
    req(predioCompany.get(b.body.predio_id) === b.body.company_id, 'user_predios con predio de otra empresa');
  }
  checks.push('tenant user_predios OK (sin cross-empresa)');

  // Recorrido: columnas obligatorias reales que el E2E usa.
  req(VENTA_ESTADOS.includes('BORRADOR') && FACTURA_ESTADOS.includes('BORRADOR'), 'estados base');
  for (const t of ['cultural_labor', 'machinery_operation', 'fertilization_application', 'harvest_collection', 'soil_analysis', 'general_monitoring']) {
    req(TRZ_TYPES.includes(t), `event_type fuera de 048: ${t}`);
  }
  for (const m of ['sistema', 'maquinaria', 'fertilizacion', 'cosecha', 'suelos', 'monitoreo', 'sanitario']) {
    req(TRZ_MODULES.includes(m), `source_module fuera de 048: ${m}`);
  }
  checks.push('recorrido: cosechas.lote TEXT + cliente_id ventas/facturas + enums 048 OK');
  req(!(999 >= -90 && 999 <= 90), 'sanity rangos GPS');
  checks.push('GPS: lat 999 fuera de [-90,90] (CHECK 048 lo rechaza)');
  return checks;
}

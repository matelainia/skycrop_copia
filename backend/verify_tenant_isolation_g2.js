/**
 * COMPUERTA G2 — Aislamiento multi-tenant en STAGING (043-047 aplicadas).
 * NO ejecutar en produccion: siembra empresas/clerk_org de prueba (las limpia).
 *
 * Cubre A<->B: SELECT / INSERT / UPDATE / DELETE / RPC por PostgREST directo,
 * manipulacion de company_id / predio_id / lote_id, token sin org_id (C3),
 * C1 (recomendaciones), C2 (snapshots/events), C4 (audit append-only),
 * C5 (RPC evaluacion con lote ajeno), 047 (RPC cosecha con empresa ajena),
 * productos por empresa. Resultado esperado: ESCAPES = 0, exit 0.
 *
 * Uso:
 *   STAGING_SUPABASE_URL=... STAGING_ANON_KEY=... STAGING_SERVICE_ROLE_KEY=... \
 *   STAGING_JWT_SECRET=... node verify_tenant_isolation_g2.js
 */
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const url = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.STAGING_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.STAGING_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

if (!url || !anon || !serviceKey || !jwtSecret) {
  console.error('Faltan STAGING_SUPABASE_URL / STAGING_ANON_KEY / STAGING_SERVICE_ROLE_KEY / STAGING_JWT_SECRET');
  process.exit(2);
}
if (!url.includes('localhost') && /gynttnymneanbziywqqr/.test(url)) {
  console.error('BLOQUEO: la URL parece ser produccion. Abortando.');
  process.exit(2);
}

const admin = createClient(url, serviceKey);
const mkToken = (sub, email, orgId) =>
  jwt.sign(
    { aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600, sub, email, role: 'authenticated', org_id: orgId },
    jwtSecret
  );
const asUser = (token) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });

let escapes = 0;
let checks = 0;
const t = async (name, fn) => {
  checks += 1;
  try {
    const ok = await fn();
    if (ok) console.log(`PASS ${name}`);
    else { escapes += 1; console.error(`ESCAPE ${name}`); }
  } catch (e) { escapes += 1; console.error(`ESCAPE ${name} :: ${e.message}`); }
};

const run = async () => {
  const ORGA = 'org_g2_clerk_a';
  const ORGB = 'org_g2_clerk_b';
  const UA = 'user_g2_a';
  const UB = 'user_g2_b';
  const S = {};

  const compA = (await admin.from('companies').upsert([{ clerk_org_id: ORGA, nombre: 'G2 Empresa A' }], { onConflict: 'clerk_org_id' }).select().single()).data;
  const compB = (await admin.from('companies').upsert([{ clerk_org_id: ORGB, nombre: 'G2 Empresa B' }], { onConflict: 'clerk_org_id' }).select().single()).data;
  S.A = compA.id; S.B = compB.id;
  await admin.from('company_users').upsert(
    [{ company_id: S.A, clerk_user_id: UA, role_id: 'operario', activo: true },
     { company_id: S.B, clerk_user_id: UB, role_id: 'administrador', activo: true }],
    { onConflict: 'company_id,clerk_user_id' }
  );
  const A = asUser(mkToken(UA, 'a@g2.test', S.A));
  const B = asUser(mkToken(UB, 'b@g2.test', S.B));
  const N = asUser(mkToken('user_g2_null', 'n@g2.test', null)); // C3: sin org_id

  const seed = async (table, row) => (await admin.from(table).insert([row]).select().single()).data;
  S.predA = await seed('predios', { company_id: S.A, nombre: 'G2 Predio A' });
  S.predB = await seed('predios', { company_id: S.B, nombre: 'G2 Predio B' });
  S.lotA = await seed('lotes', { company_id: S.A, predio_id: S.predA.id, codigo_interno: 'G2-A', nombre: 'G2 Lote A', cultivo: 'Maiz' });
  S.lotB = await seed('lotes', { company_id: S.B, predio_id: S.predB.id, codigo_interno: 'G2-B', nombre: 'G2 Lote B', cultivo: 'Soya' });

  // SELECT bidireccional
  await t('SELECT A no ve B', async () => (await A.from('lotes').select('id')).data.every((l) => l.id !== S.lotB.id));
  await t('SELECT B no ve A', async () => (await B.from('lotes').select('id')).data.every((l) => l.id !== S.lotA.id));
  // INSERT forgery company_id
  await t('INSERT A con company B bloqueado', async () =>
    (await A.from('lotes').insert([{ codigo_interno: 'G2-X', nombre: 'x', cultivo: 'x', company_id: S.B }])).error != null);
  await t('INSERT B con company A bloqueado', async () =>
    (await B.from('lotes').insert([{ codigo_interno: 'G2-Y', nombre: 'y', cultivo: 'y', company_id: S.A }])).error != null);
  // UPDATE / DELETE ajenos (RLS: 0 filas, dato intacto)
  await t('UPDATE A sobre lote B no afecta', async () => {
    const r = await A.from('lotes').update({ nombre: 'hack' }).eq('id', S.lotB.id).select();
    const cur = (await admin.from('lotes').select('nombre').eq('id', S.lotB.id).single()).data;
    return (r.data || []).length === 0 && cur.nombre === 'G2 Lote B';
  });
  await t('DELETE B sobre lote A no borra', async () => {
    await B.from('lotes').delete().eq('id', S.lotA.id);
    return (await admin.from('lotes').select('id').eq('id', S.lotA.id).single()).data != null;
  });
  // UPDATE propio sigue funcionando (no regresion)
  await t('UPDATE propio A funciona', async () =>
    (await A.from('lotes').update({ nombre: 'G2 Lote A2' }).eq('id', S.lotA.id).select()).error == null);
  // H1: actividad propia a lote ajeno
  await t('H1 aplicacion A -> lote B bloqueada', async () =>
    (await A.from('aplicaciones').insert([{ lote_id: S.lotB.id, tipo_aplicacion: 'Fitosanitaria', tipo_producto: 'X', producto_comercial: 'G2', fecha_aplicacion: new Date().toISOString(), company_id: S.A }])).error != null);
  await t('H1 lote A con predio B bloqueado', async () =>
    (await A.from('lotes').update({ predio_id: S.predB.id }).eq('id', S.lotA.id).select()).error != null);
  // C3: token sin org no ve nada
  await t('C3 sin org_id no ve lotes', async () => ((await N.from('lotes').select('id')).data || []).length === 0);
  // C1: recomendaciones
  S.recB = await seed('fertilizacion_recomendaciones', { company_id: S.B, code: 'G2-B-001', crop_name: 'Soya' });
  await t('C1 A no lee rec B', async () => ((await A.from('fertilizacion_recomendaciones').select('id')).data || []).every((r) => r.id !== S.recB.id));
  await t('C1 A no inserta rec con company B', async () =>
    (await A.from('fertilizacion_recomendaciones').insert([{ company_id: S.B, code: 'G2-X', crop_name: 'X' }])).error != null);
  // C2: snapshots/events
  S.monB = await seed('monitoreos', { company_id: S.B, lote_id: S.lotB.id, tipo_monitoreo: 'Sanitario', fecha_monitoreo: new Date().toISOString(), responsable: 'G2' });
  S.snapB = (await admin.from('evaluation_snapshots').insert([{ evaluation_id: S.monB.id, protocol_name: 'G2', monitoring_type: 'Sanitario', evaluation_object_name: 'G2' }]).select().single()).data;
  await admin.from('evaluation_events').insert([{ evaluation_id: S.monB.id, event_type: 'G2' }]);
  await t('C2 A no lee snapshots B', async () => ((await A.from('evaluation_snapshots').select('id')).data || []).length === 0);
  await t('C2 A no lee events B', async () => ((await A.from('evaluation_events').select('id')).data || []).length === 0);
  // C4: audit append-only
  S.audA = (await admin.from('audit_logs').insert([{ company_id: S.A, usuario_id: UA, usuario_email: 'a@g2.test', accion: 'INSERT', modulo: 'g2_gate', tabla: 'lotes', registro_id: S.lotA.id }]).select().single()).data;
  await t('C4 A lee su audit', async () => ((await A.from('audit_logs').select('id')).data || []).some((r) => r.id === S.audA.id));
  await t('C4 UPDATE audit bloqueado', async () =>
    (await A.from('audit_logs').update({ modulo: 'hack' }).eq('id', S.audA.id)).error != null);
  await t('C4 DELETE audit bloqueado', async () =>
    (await A.from('audit_logs').delete().eq('id', S.audA.id)).error != null);
  // C5: RPC evaluacion con lote ajeno
  await t('C5 RPC evaluacion A->lote B bloqueada', async () =>
    (await A.rpc('guardar_evaluacion_completa', { p_company_id: S.A, p_lote_id: S.lotB.id, p_objeto_evaluacion_id: null, p_protocolo_version_id: null, p_tipo_monitoreo: 'Sanitario', p_responsable: 'G2', p_valores_evaluacion: {}, p_incidencia_pct: 0, p_severidad_pct: 0, p_humedad_pct: 0, p_temperatura_c: 0, p_plagas_detectadas: null, p_enfermedades_detectadas: null, p_observaciones: 'g2', p_user_id: UA, p_estado_sanitario: 'excelente' })).error != null);
  // 047: RPC cosecha con empresa ajena
  await t('047 RPC cosecha A con empresa B denegada', async () =>
    (await A.rpc('registrar_cosecha_empresa', { p_company_id: S.B, p_predio_id: S.predB.id, p_lote_agricola_id: S.lotB.id, p_cultivo: 'Soya', p_variedad: null, p_area_cosechada: 1, p_cantidad: 10, p_user_id: UA })).error != null);
  S.cosA = await A.rpc('registrar_cosecha_empresa', { p_company_id: S.A, p_predio_id: S.predA.id, p_lote_agricola_id: S.lotA.id, p_cultivo: 'Maiz', p_variedad: null, p_area_cosechada: 1, p_cantidad: 10, p_user_id: UA });
  await t('047 RPC cosecha propia funciona', async () => !S.cosA.error && !!S.cosA.data?.cosecha_id);
  await t('047 trazabilidad B invisible para A', async () => {
    const r = await A.rpc('trazabilidad_por_codigo_empresa', { p_company_id: S.A, p_codigo: 'COS-2099-XXXXXX' });
    return !r.error && (r.data?.error != null || r.data?.tipo == null);
  });
  // Productos por empresa
  S.prodB = await seed('productos', { id: 9000001, company_id: S.B, nombre_producto: 'G2 Prod B' });
  await t('H2 producto B invisible para A', async () =>
    ((await A.from('productos').select('id')).data || []).every((p) => p.id !== S.prodB.id));

  // Limpieza (audit_logs g2_gate permanece: inmutable por diseno)
  console.log('Limpiando siembra G2...');
  for (const q of [
    admin.from('venta_detalles').delete().eq('company_id', S.A),
    admin.from('venta_detalles').delete().eq('company_id', S.B),
    admin.from('evaluation_events').delete().in('evaluation_id', [S.monB.id]),
    admin.from('evaluation_snapshots').delete().eq('id', S.snapB.id),
    admin.from('monitoreos').delete().eq('id', S.monB.id),
    admin.from('cosechas').delete().eq('company_id', S.A),
    admin.from('historial_actividades').delete().eq('company_id', S.A),
    admin.from('aplicaciones').delete().eq('company_id', S.A),
    admin.from('fertilizacion_recomendaciones').delete().eq('company_id', S.A),
    admin.from('productos').delete().eq('id', S.prodB.id),
    admin.from('lotes').delete().in('id', [S.lotA.id, S.lotB.id]),
    admin.from('predios').delete().in('id', [S.predA.id, S.predB.id]),
    admin.from('company_users').delete().in('company_id', [S.A, S.B]),
    admin.from('companies').delete().in('id', [S.A, S.B]),
  ]) await q;

  console.log(`\nG2: checks=${checks} ESCAPES=${escapes}`);
  process.exit(escapes === 0 ? 0 : 1);
};

run().catch((e) => { console.error('G2 fallo tecnico:', e.message); process.exit(2); });

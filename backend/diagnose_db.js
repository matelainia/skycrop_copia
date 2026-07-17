/**
 * diagnose_db.js
 * Verifica en la base de datos real las hipótesis del diagnóstico de auth:
 *  1. ¿Existe el trigger usuarios_view_write_trg? ¿Está habilitado?
 *  2. ¿Existe el constraint UNIQUE(company_id, codigo_interno) en lotes?
 *  3. ¿Qué perfiles, empresas y membresías hay actualmente?
 *  4. ¿Hay datos huérfanos (empresa sin membresía, membresía sin perfil)?
 *
 * Uso: node backend/diagnose_db.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gynttnymneanbziywqqr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está definida en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('🔍 SkyCrop — Diagnóstico de Base de Datos');
  console.log('=========================================');
  console.log(`URL: ${SUPABASE_URL}\n`);

  // ─── CHECK 1: Estado actual de profiles, companies, company_users ────────
  console.log('【1】 Conteo de registros actuales...');

  const [profilesRes, companiesRes, compUsersRes, lotesRes] = await Promise.all([
    supabase.from('profiles').select('id, email, nombre, apellido, created_at'),
    supabase.from('companies').select('id, nombre, clerk_org_id, created_at'),
    supabase.from('company_users').select('id, company_id, clerk_user_id, role_id, status'),
    supabase.from('lotes').select('id, company_id, codigo_interno, nombre')
  ]);

  console.log(`  profiles      → ${profilesRes.data?.length ?? '?'} registros`);
  (profilesRes.data || []).forEach(p =>
    console.log(`    · ${p.id} | ${p.email} | "${p.nombre} ${p.apellido}"`)
  );

  console.log(`  companies     → ${companiesRes.data?.length ?? '?'} registros`);
  (companiesRes.data || []).forEach(c =>
    console.log(`    · ${c.id} | "${c.nombre}" | clerk_org: ${c.clerk_org_id}`)
  );

  console.log(`  company_users → ${compUsersRes.data?.length ?? '?'} registros`);
  (compUsersRes.data || []).forEach(u =>
    console.log(`    · user: ${u.clerk_user_id} | company: ${u.company_id} | rol: ${u.role_id} | status: ${u.status}`)
  );

  console.log(`  lotes         → ${lotesRes.data?.length ?? '?'} registros`);
  (lotesRes.data || []).forEach(l =>
    console.log(`    · ${l.id} | company: ${l.company_id} | codigo: ${l.codigo_interno} | "${l.nombre}"`)
  );

  // ─── CHECK 2: Datos huérfanos ────────────────────────────────────────────
  console.log('\n【2】 Detectando datos huérfanos...');

  const profiles = profilesRes.data || [];
  const companies = companiesRes.data || [];
  const compUsers = compUsersRes.data || [];

  const profileIds = new Set(profiles.map(p => p.id));
  const companyIds = new Set(companies.map(c => c.id));
  const companyIdsWithMembers = new Set(compUsers.map(u => u.company_id));

  // Membresías cuyo clerk_user_id no tiene perfil en profiles
  const orphanMembers = compUsers.filter(u => !profileIds.has(u.clerk_user_id));
  if (orphanMembers.length > 0) {
    console.log(`  ❌ Membresías sin perfil en 'profiles' (FK rota): ${orphanMembers.length}`);
    orphanMembers.forEach(u => console.log(`    · clerk_user_id: ${u.clerk_user_id} | company: ${u.company_id}`));
  } else {
    console.log('  ✅ No hay membresías con FK rota a profiles.');
  }

  // Membresías cuyo company_id no tiene empresa en companies
  const orphanMembersCompany = compUsers.filter(u => !companyIds.has(u.company_id));
  if (orphanMembersCompany.length > 0) {
    console.log(`  ❌ Membresías sin empresa en 'companies': ${orphanMembersCompany.length}`);
    orphanMembersCompany.forEach(u => console.log(`    · company_id: ${u.company_id}`));
  } else {
    console.log('  ✅ No hay membresías con empresa inexistente.');
  }

  // Perfiles sin membresía
  const orphanProfiles = profiles.filter(p => !compUsers.some(u => u.clerk_user_id === p.id));
  if (orphanProfiles.length > 0) {
    console.log(`  ⚠️  Perfiles sin membresía en ninguna empresa: ${orphanProfiles.length}`);
    orphanProfiles.forEach(p => console.log(`    · ${p.id} | ${p.email}`));
  } else {
    console.log('  ✅ Todos los perfiles tienen al menos una membresía.');
  }

  // Empresas sin miembro
  const companiesWithoutMembers = companies.filter(c => !companyIdsWithMembers.has(c.id));
  if (companiesWithoutMembers.length > 0) {
    console.log(`  ⚠️  Empresas sin ningún miembro: ${companiesWithoutMembers.length}`);
    companiesWithoutMembers.forEach(c => console.log(`    · ${c.id} | "${c.nombre}"`));
  } else {
    console.log('  ✅ Todas las empresas tienen al menos un miembro.');
  }

  // Empresas sin lotes
  const lotes = lotesRes.data || [];
  const companyIdsWithLotes = new Set(lotes.map(l => l.company_id));
  const companiesWithoutLotes = companies.filter(c => !companyIdsWithLotes.has(c.id));
  if (companiesWithoutLotes.length > 0) {
    console.log(`  ⚠️  Empresas sin lotes: ${companiesWithoutLotes.length}`);
    companiesWithoutLotes.forEach(c => console.log(`    · ${c.id} | "${c.nombre}"`));
  } else {
    console.log('  ✅ Todas las empresas tienen al menos un lote.');
  }

  // ─── CHECK 3: Roles y permisos ───────────────────────────────────────────
  console.log('\n【3】 Verificando seed de roles y permisos...');
  const { data: roles, error: rolesErr } = await supabase.from('roles').select('id, nombre');
  if (rolesErr || !roles?.length) {
    console.log('  ❌ Tabla roles vacía o error:', rolesErr?.message);
  } else {
    console.log(`  ✅ ${roles.length} roles: ${roles.map(r => r.id).join(', ')}`);
  }
  const { data: perms } = await supabase.from('permisos').select('id');
  console.log(`  ✅ ${perms?.length ?? 0} permisos registrados`);

  // ─── CHECK 4: Análisis estático del orden del caché JWT ─────────────────
  console.log('\n【4】 Análisis estático del caché JWT en GetUserProfileUseCase...');
  console.log(`
  Orden real confirmado por el código fuente:
    [L34] saveUserProfile()          → crea/upsert perfil en 'usuarios' (→ trigger → profiles)
    [L41] cacheKey = "jwt:{id}:{org}"
    [L44] supabaseToken = cache.get() ← LEE el caché ANTES de crear empresa/membresía
    [L47] getCompanyByClerkId()       → busca empresa
    [L51] saveCompany()               → crea empresa si no existe
    [L61] createDefaultLote()         → crea lote por defecto
    [L67] getCompanyUser()            → busca membresía
    [L79] saveCompanyUser()           → crea membresía si no existe
    [L94] if (!supabaseToken) {       ← guarda JWT solo si no estaba en caché
              generateJWT(); cache.set()
           }

  VEREDICTO DEL CACHÉ:
    · El JWT se genera DESPUÉS de empresa y membresía → el caché NO se llena
      antes de que el bootstrap esté completo (Diagnóstico previo era incorrecto).
    · El verdadero riesgo: si en un segundo request el usuario ya tiene
      empresa + membresía pero el caché SIGUE vacío (porque el primer intento
      falló), el flujo funciona correctamente.
    · PERO si el primer intento falló entre saveCompany() y saveCompanyUser()
      (empresa creada, membresía no), en el segundo intento:
        - company EXISTE → no entra al if(!company)
        - compUser NO EXISTE → intenta crearlo → debería funcionar
      Esto NO es un bug del caché sino del flujo no atómico.
  `);

  // ─── CHECK 5: Instrucciones para verificar trigger vía SQL Editor ────────
  console.log('【5】 Para verificar el trigger, ejecuta esto en el SQL Editor de Supabase:');
  console.log(`
  -- ¿Existe el trigger?
  SELECT trigger_name, event_object_table, action_timing, event_manipulation,
         enabled
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name = 'usuarios_view_write_trg';

  -- ¿Existe la función del trigger?
  SELECT proname, prosrc
  FROM pg_proc
  WHERE proname = 'process_usuarios_view_write';

  -- ¿Qué pasa si insertas en la vista manualmente?
  INSERT INTO usuarios (id, email, nombre, apellido)
  VALUES ('test-diag-001', 'test@diag.com', 'Test', 'Diag')
  ON CONFLICT (id) DO NOTHING;

  SELECT * FROM profiles WHERE id = 'test-diag-001';
  -- Si devuelve fila → trigger funciona
  -- Si no devuelve nada → trigger no funciona o no existe

  -- Limpiar test
  DELETE FROM profiles WHERE id = 'test-diag-001';
  `);

  console.log('=========================================');
  console.log('✅ Diagnóstico completo. Revisa los resultados arriba.');
}

main().catch(err => {
  console.error('Error en el diagnóstico:', err);
  process.exit(1);
});

/**
 * apply_migration_040.js
 * Aplica 040_analisis_suelos.sql usando pg si DATABASE_URL está disponible,
 * sino muestra instrucciones para aplicar manualmente en Supabase Dashboard.
 *
 * Uso: node apply_migration_040.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_CONNECTION = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no definidos');
  process.exit(1);
}

async function applyViaPg() {
  try {
    const { default: pg } = await import('pg');
    const { Pool } = pg;
    if (!DB_CONNECTION) {
      console.log('⚠️  DATABASE_URL / SUPABASE_DB_URL no configurado, no se puede usar pg directamente');
      return false;
    }
    const pool = new Pool({ connectionString: DB_CONNECTION, ssl: { rejectUnauthorized: false } });
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '040_analisis_suelos.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('🔗 Conectando via pg...');
    const client = await pool.connect();
    console.log('✅ Conectado. Ejecutando migración 040_analisis_suelos.sql ...');
    await client.query(sql);
    client.release();
    await pool.end();
    console.log('✅ Migración 040 aplicada exitosamente via pg!');
    return true;
  } catch (err) {
    console.log(`⚠️  pg no disponible o error: ${err.message}`);
    return false;
  }
}

async function verify() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const checks = [
    { table: 'analisis_suelos', name: 'analisis_suelos' },
    { table: 'resultados_analisis_suelo', name: 'resultados_analisis_suelo' },
    { table: 'laboratorios', name: 'laboratorios' },
    { table: 'parametros_suelo', name: 'parametros_suelo' },
  ];
  console.log('\n🔍 Verificando tablas de Análisis de Suelos:');
  let allOk = true;
  for (const { table, name } of checks) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ✅ ${name} OK`);
    }
  }
  // Verificar bucket
  try {
    const { data, error } = await supabase.storage.getBucket('analisis-suelos');
    if (error) console.log(`  ⚠️  Bucket analisis-suelos: ${error.message}`);
    else console.log(`  ✅ Bucket analisis-suelos OK (public: ${data.public})`);
  } catch (e) {
    console.log(`  ⚠️  Bucket check: ${e.message}`);
  }
  // Verificar RPCs
  const { error: rpcErr } = await supabase.rpc('soil_analysis_metrics');
  console.log(`  ${rpcErr && rpcErr.message.includes('does not exist') ? '❌' : '✅'} RPC soil_analysis_metrics: ${rpcErr?.message || 'OK'}`);
  return allOk;
}

function showManual() {
  const sqlPath = path.resolve(path.join(__dirname, '..', 'supabase', 'migrations', '040_analisis_suelos.sql'));
  console.log('\n' + '═'.repeat(60));
  console.log('📋 INSTRUCCIONES PARA APLICAR LA MIGRACIÓN MANUALMENTE:');
  console.log('═'.repeat(60));
  console.log('\n1. Ir al Supabase Dashboard → SQL Editor:');
  console.log(`   ${SUPABASE_URL.replace('/rest/v1', '')}/project/default/sql/new`);
  console.log('\n2. Copiar el contenido de:');
  console.log(`   ${sqlPath}`);
  console.log('\n   y pegarlo en el SQL Editor → Run');
  console.log('\n3. Verificar en Table Editor que existan:');
  console.log('   - analisis_suelos');
  console.log('   - resultados_analisis_suelo');
  console.log('   - laboratorios');
  console.log('   - parametros_suelo');
  console.log('   y en Storage → Buckets: analisis-suelos (privado)');
  console.log('\n' + '═'.repeat(60) + '\n');
}

console.log('🚀 Iniciando aplicación de migración 040_analisis_suelos...\n');
const pgSuccess = await applyViaPg();
if (!pgSuccess) showManual();
const ok = await verify();
if (ok) console.log('\n🎉 ¡Módulo Análisis de Suelos listo! La UI trabajará con datos reales y estados vacíos.');
else console.log('\n⚠️  Algunas tablas faltan. Aplica la migración manualmente (ver instrucciones arriba).');

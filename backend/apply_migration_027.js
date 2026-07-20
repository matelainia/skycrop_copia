/**
 * run_migration.js
 * Aplica 027_multi_cultivo.sql usando el endpoint /rest/v1/ de Supabase
 * con service_role. Ejecutar desde la carpeta backend/:
 *   node run_migration.js
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import https from 'https';
import { URL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL       = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_CONNECTION      = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no definidos');
  process.exit(1);
}

// ─── Opción 1: Usar pg directamente si está disponible ──────────────────────
async function applyViaPg() {
  try {
    const { default: pg } = await import('pg');
    const { Pool } = pg;

    if (!DB_CONNECTION) {
      console.log('⚠️  DATABASE_URL no configurado, no se puede usar pg directamente');
      return false;
    }

    const pool = new Pool({ connectionString: DB_CONNECTION, ssl: { rejectUnauthorized: false } });
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '027_multi_cultivo.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔗 Conectando via pg...');
    const client = await pool.connect();
    console.log('✅ Conectado. Ejecutando migración...');
    await client.query(sql);
    client.release();
    await pool.end();
    console.log('✅ Migración aplicada exitosamente via pg!');
    return true;
  } catch (err) {
    console.log(`⚠️  pg no disponible o error: ${err.message}`);
    return false;
  }
}

// ─── Opción 2: Supabase Client – verificar tablas existentes ────────────────
async function verifyTables() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tables = [
    'cultivos', 'estados_fenologicos', 'objetos_evaluacion',
    'cultivo_objetos', 'protocolos_evaluacion', 'umbrales_economicos',
    'reglas_agronomicas', 'objeto_tratamientos'
  ];

  console.log('\n🔍 Verificando estado de tablas:');
  let allOk = true;
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ✅ ${table} OK`);
    }
  }

  // Verificar columnas en lotes y monitoreos
  const { data: lotesCols, error: lotesErr } = await supabase
    .from('lotes').select('cultivo_id').limit(1);
  console.log(`  ${lotesErr ? '❌' : '✅'} lotes.cultivo_id: ${lotesErr?.message || 'OK'}`);

  const { data: monCols, error: monErr } = await supabase
    .from('monitoreos').select('objeto_evaluacion_id, protocolo_version_id, valores_evaluacion').limit(1);
  console.log(`  ${monErr ? '❌' : '✅'} monitoreos (nuevas columnas): ${monErr?.message || 'OK'}`);

  return allOk;
}

// ─── Opción 3: Mostrar instrucciones para aplicar manualmente ───────────────
function showManualInstructions() {
  const sqlPath = path.resolve(path.join(__dirname, '..', 'supabase', 'migrations', '027_multi_cultivo.sql'));
  console.log('\n' + '═'.repeat(60));
  console.log('📋 INSTRUCCIONES PARA APLICAR LA MIGRACIÓN MANUALMENTE:');
  console.log('═'.repeat(60));
  console.log('\n1. Ir al Supabase Dashboard:');
  console.log(`   ${SUPABASE_URL.replace('/rest/v1', '')}/project/default/sql/new`);
  console.log('\n2. O usar Supabase CLI:');
  console.log('   supabase db push');
  console.log('\n3. O copiar el contenido de:');
  console.log(`   ${sqlPath}`);
  console.log('\n   y pegarlo en el SQL Editor del Dashboard.');
  console.log('\n' + '═'.repeat(60) + '\n');
}

// ─── Ejecución principal ────────────────────────────────────────────────────
console.log('🚀 Iniciando aplicación de migración 027_multi_cultivo...\n');

const pgSuccess = await applyViaPg();

if (!pgSuccess) {
  showManualInstructions();
}

// Siempre verificar el estado actual
const allTablesExist = await verifyTables();

if (allTablesExist) {
  console.log('\n🎉 ¡Todas las tablas están listas! El sistema multi-cultivo está activo.');
} else {
  console.log('\n⚠️  Algunas tablas faltan. Por favor aplica la migración manualmente.');
}

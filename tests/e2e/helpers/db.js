/**
 * SKYCROP E2E — Supabase real (TEST/STAGING) + limpieza controlada.
 *
 * Estrategia (spec §21):
 *   TEST RUN → CREATE TEST DATA → EXECUTE → VALIDATE → REPORT → CLEANUP
 *   - operational test data → cleanup (DELETE por metadata.test_run_id)
 *   - audit evidence        → retain temporalmente (para investigar fallas)
 *   - test report           → retain (JSON/MD/HTML en tests/e2e/reports)
 *
 * Todas las escrituras reales deben incluir metadata.test_run_id = TEST_RUN_ID.
 */
function env(name, fallback = null) {
  return process.env[name] ?? fallback;
}

export function hasRealCredentials() {
  return Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));
}

async function loadSupabase() {
  try {
    const mod = await import('@supabase/supabase-js');
    return mod.createClient;
  } catch {
    throw new Error('Falta @supabase/supabase-js para modo real. Ejecuta desde backend o instala la dep.');
  }
}

export async function supabaseAdmin() {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para modo real.');
  const createClient = await loadSupabase();
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Tablas operacionales candidatas a limpieza por test_run_id en metadata. */
const CLEANABLE_TABLES = [
  'traceability_events',
  'cosechas',
  'monitoreos',
  'aplicaciones',
  'programaciones',
  'ejecuciones',
  'evaluaciones',
  'lotes',
  'predios',
  'trabajadores',
  'company_members',
  // companies al final (CASCADE cubre el resto si se configuró)
  'companies'
];

/**
 * Limpieza controlada: borra solo registros con metadata->>'test_run_id' = runId
 * o denominados E2E_* para el company/farm sintético.
 */
export async function cleanupTestData({ runId, keepData = false, logger = console }) {
  if (keepData) {
    logger.log(`[cleanup] --keep-data activo: se conserva evidencia del run ${runId}`);
    return { kept: true, runId };
  }
  if (!hasRealCredentials()) {
    logger.log('[cleanup] sin credenciales reales: nada que limpiar (dry-run).');
    return { dryRun: true, runId };
  }
  const sb = await supabaseAdmin();
  const deleted = {};
  // 1. Operacionales con metadata.test_run_id (las que tengan columna metadata)
  const withMetadata = ['traceability_events', 'cosechas', 'monitoreos', 'aplicaciones', 'programaciones', 'ejecuciones'];
  for (const table of withMetadata) {
    try {
      const { error, count } = await sb
        .from(table)
        .delete({ count: 'exact' })
        .eq('metadata->>test_run_id', runId);
      deleted[table] = error ? `ERROR: ${error.message}` : (count ?? 'ok');
    } catch (e) {
      deleted[table] = `SKIP: ${e.message}`;
    }
  }
  // 2. Compañías sintéticas E2E_* de este run (nombre contiene runId corto o prefijo E2E)
  try {
    const { error, count } = await sb
      .from('companies')
      .delete({ count: 'exact' })
      .like('nombre', `%E2E%${runId.slice(-3)}%`);
    deleted.companies = error ? `ERROR: ${error.message}` : (count ?? 'ok');
  } catch (e) {
    deleted.companies = `SKIP: ${e.message}`;
  }
  logger.log(`[cleanup] run ${runId}:`, deleted);
  logger.log('[cleanup] audit_logs y reportes se RETIENEN temporalmente para investigación (spec §21).');
  return { deleted, runId };
}

export async function countByTestRun({ runId, table }) {
  const sb = await supabaseAdmin();
  const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true }).eq('metadata->>test_run_id', runId);
  if (error) throw error;
  return count ?? 0;
}

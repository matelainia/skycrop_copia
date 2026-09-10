/**
 * SKYCROP E2E — Environment guard + TEST_RUN_ID
 *
 * Reglas no negociables:
 *  - El usuario sintético SOLO existe en TEST / STAGING. Jamás en PRODUCCIÓN.
 *  - Todo registro generado debe ser asociable a TEST_RUN_ID vía metadata.test_run_id.
 *  - Sin .env de test/staging válido → solo se permite --dry-run (simulador en memoria).
 *
 * Uso:
 *   node tests/e2e/runner.js --env=test --dry-run
 *   node tests/e2e/runner.js --env=staging
 *
 * TEST_RUN_ID formato: E2E-YYYY-MM-DD-NNN (ej. E2E-2026-09-10-001)
 */

const ALLOWED_ENVS = ['local', 'test', 'staging'];
const BLOCKED_MARKERS = ['prod', 'production', 'skycrop.app', 'backend.skycrop.app'];

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

export function generateTestRunId(date = new Date(), seq = 1) {
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return `E2E-${y}-${m}-${d}-${pad(seq, 3)}`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { env: 'test', dryRun: false, seq: 1, runId: null, keepData: false, verbose: false };
  for (const a of argv) {
    if (a.startsWith('--env=')) args.env = a.split('=')[1].toLowerCase();
    else if (a === '--dry-run' || a === '--dryRun') args.dryRun = true;
    else if (a.startsWith('--seq=')) args.seq = Number(a.split('=')[1]) || 1;
    else if (a.startsWith('--run-id=')) args.runId = a.split('=')[1];
    else if (a === '--keep-data') args.keepData = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
  }
  return args;
}

/**
 * Falla cerrado si se detecta entorno productivo.
 * @throws {Error} si el entorno no es seguro para datos sintéticos.
 */
export function assertSafeEnvironment({ env, supabaseUrl, nodeEnv }) {
  const e = String(env || '').toLowerCase();
  if (!ALLOWED_ENVS.includes(e)) {
    throw new Error(
      `[ENV-GUARD] Entorno "${env}" no permitido para E2E. Permitidos: ${ALLOWED_ENVS.join(', ')}. ` +
        `PRODUCCIÓN está bloqueada por diseño.`
    );
  }
  if (String(nodeEnv || '').toLowerCase() === 'production') {
    throw new Error('[ENV-GUARD] NODE_ENV=production detectado. Abortando: el test sintético jamás corre en producción.');
  }
  const url = String(supabaseUrl || '').toLowerCase();
  for (const marker of BLOCKED_MARKERS) {
    // Permitir el marcador solo si el env explícito es local/test y la URL es localhost o supabase de test.
    // Cualquier URL con dominio productivo conocido + env != local → bloquear.
    if (url.includes(marker) && (marker.includes('skycrop.app'))) {
      throw new Error(
        `[ENV-GUARD] SUPABASE_URL apunta a producción (${marker}). Abortando. ` +
          `Usa un proyecto Supabase dedicado a TEST/STAGING.`
      );
    }
  }
  if (e === 'staging' && (!url || url.includes('localhost'))) {
    console.warn('[ENV-GUARD] STAGING con URL localhost: verifica que apunte al proyecto staging real.');
  }
  return true;
}

export function resolveTestRunId(args, date = new Date()) {
  if (args.runId) {
    if (!/^E2E-\d{4}-\d{2}-\d{2}-\d{3}$/.test(args.runId)) {
      throw new Error(`[ENV-GUARD] TEST_RUN_ID inválido: ${args.runId}. Formato esperado E2E-YYYY-MM-DD-NNN`);
    }
    return args.runId;
  }
  return generateTestRunId(date, args.seq);
}

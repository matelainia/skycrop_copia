/**
 * Runner de checks SQL de staging. Solo lectura (los .sql son SELECT).
 * Uso:
 *   STAGING_DATABASE_URL=postgres://... node run_staging_checks.js ../scripts/staging/staging_checks.sql
 * STAGING_DATABASE_URL sale del Dashboard de STAGING (nunca produccion).
 */
import pg from 'pg';
import fs from 'node:fs';

const conn = process.env.STAGING_DATABASE_URL;
const file = process.argv[2];
if (!conn || !file) {
  console.error('Uso: STAGING_DATABASE_URL=... node run_staging_checks.js <archivo.sql>');
  process.exit(2);
}
if (/gynttnymneanbziywqqr/.test(conn)) {
  console.error('BLOQUEO: la URL parece ser produccion. Abortando.');
  process.exit(2);
}
const sql = fs.readFileSync(file, 'utf8');
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();
// Divide por bloques de SELECT separados por ';' fuera de funciones: los archivos
// contienen sentencias simples + CREATE-less SELECTs; se ejecutan una por una.
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('-- ================================================================='));
let fail = 0;
for (const st of statements) {
  if (!/^SELECT|^WITH/i.test(st.replace(/^--.*$/gm, '').trim())) continue;
  try {
    const r = await client.query(st);
    for (const row of r.rows) {
      const vals = Object.values(row);
      console.log(JSON.stringify(row));
      if ('status' in row && row.status !== 'PASS') fail += 1;
      void vals;
    }
  } catch (e) {
    fail += 1;
    console.error('ERROR SQL:', e.message);
  }
}
await client.end();
console.log(`\nFAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);

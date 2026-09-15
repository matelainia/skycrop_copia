#!/usr/bin/env node
/**
 * SKYCROP E2E REAL — identify.js (solo lectura, cero escrituras).
 * Huella del proyecto Supabase configurado: host, conteos, muestra de empresas,
 * marcadores E2E, presencia 050/051, buckets y RLS observable.
 * Aborta con exit 3 si el proyecto NO parece TEST (demasiadas empresas/usuarios).
 *
 * Uso:
 *   node tests/e2e/real/identify.js --env=test
 */
try { await import('dotenv/config'); } catch { /* opcional */ }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRealArgs } from './real-env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carga backend/.env si las vars no están en el entorno (sin imprimir valores).
function loadBackendEnv() {
  if (process.env.SUPABASE_URL) return 'process';
  for (const p of [path.join(__dirname, '..', '..', '..', 'backend', '.env'), path.join(process.cwd(), 'backend', '.env')]) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
      }
      return p;
    } catch { /* siguiente */ }
  }
  return null;
}

async function count(cfg, table, query = '?select=id&limit=0') {
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query}`, {
    headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}`, Prefer: 'count=exact' }
  });
  const cr = res.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+)$/) || cr.match(/^\*\/(\d+)/);
  const text = await res.text().catch(() => '');
  return { status: res.status, total: m ? Number(m[1]) : null, range: cr, sample: text.slice(0, 200) };
}

async function main() {
  const args = parseRealArgs();
  const envSrc = loadBackendEnv();
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[identify] Sin SUPABASE_URL/SERVICE_ROLE (env + backend/.env vacíos).');
    process.exit(2);
  }
  const cfg = { url, service: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.SUPABASE_JWT_SECRET || '' };
  console.log(`host: ${new URL(url).host} · env-src: ${envSrc === 'process' ? 'environment' : envSrc || '?'}`);

  const companies = await count(cfg, 'companies');
  console.log(`companies: http=${companies.status} total=${companies.total ?? '?'} ${companies.total === null ? companies.sample : ''}`);
  let names = [];
  if (companies.status === 200 || companies.status === 206) {
    const r = await fetch(`${url}/rest/v1/companies?select=id,nombre&limit=10`, {
      headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` }
    });
    const t = await r.text().catch(() => '');
    try { names = JSON.parse(t); } catch { names = []; console.log(`  (nombres: http=${r.status} no-JSON: ${t.slice(0, 120)}`); }
    if (!Array.isArray(names)) { console.log(`  (nombres: http=${r.status} forma inesperada)`); names = []; }
    for (const c of names) console.log(`  - ${String(c.nombre).slice(0, 60)}`);
  }
  const users = await count(cfg, 'company_users');
  const predios = await count(cfg, 'predios');
  const up = await count(cfg, 'user_predios', '?select=company_id&limit=0'); // PK compuesta, sin columna id
  console.log(`company_users: ${users.status}/${users.total ?? '?'} · predios: ${predios.status}/${predios.total ?? '?'} · user_predios: ${up.status}/${up.total ?? 'AUSENTE(050?)'}`);
  for (const fn of ['tiene_acceso_predio', 'alcance_operativo', 'predio_de_lote', 'registrar_evento_trazabilidad', 'verificar_cadena_lote']) {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}`, 'Content-Type': 'application/json' }, body: '{}'
    });
    console.log(`rpc ${fn}: ${r.status}${r.status === 404 ? ' AUSENTE' : ''}`);
  }
  try {
    const b = await fetch(`${url}/storage/v1/bucket`, { headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` } });
    const list = await b.json().catch(() => []);
    console.log(`buckets: ${(Array.isArray(list) ? list : []).map((x) => x.name || x.id).join(',') || '(vacío/error)'}`);
  } catch (e) { console.log(`buckets: ERROR ${e.message}`); }
  try {
    const a = await fetch(`${url}/rest/v1/predios?select=id&limit=1`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY || cfg.service }
    });
    const body = await a.text().catch(() => '');
    console.log(`anon GET predios: http=${a.status} filas=${body.startsWith('[') ? JSON.parse(body).length : '?'} (200 con filas = RLS christmas?)`);
  } catch (e) { console.log(`anon probe: ERROR ${e.message}`); }

  const e2e = names.filter((c) => /e2e/i.test(c.nombre || '')).length;
  console.log(`marcadores E2E en empresas: ${e2e}/${names.length}`);
  if ((companies.total ?? 0) > 20 || (users.total ?? 0) > 500) {
    console.error('[identify] EXIT 3: el proyecto NO parece TEST (volumen alto). Detenido antes de escribir nada.');
    process.exit(3);
  }
  if (up.status === 404 || up.total === null) console.log('[identify] AVISO: user_predios ausente → 050 sin aplicar.');
  console.log('[identify] OK: pinta de TEST (verifica nombres arriba antes del --live).');
}

main().catch((e) => { console.error(`[identify] ABORT: ${e.message}`); process.exit(2); });

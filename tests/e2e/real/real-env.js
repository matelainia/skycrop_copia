/**
 * SKYCROP E2E REAL — Entorno, JWTs de prueba y cliente REST sin dependencias.
 *
 * Autenticación real (§4): se firman JWTs HS256 con SUPABASE_JWT_SECRET del
 * proyecto TEST/STAGING (el mismo secreto que valida PostgREST en modo legacy).
 * Claims: sub = clerk_user_id sintético, org_id = company UUID (lo que lee
 * public.current_company()), exp limitado al run. Sin token / expirado / firma
 * inválida deben producir DENY/401.
 *
 * Seguridad del runner:
 *  - Requiere --live para tocar Supabase. Sin --live solo self-checks locales.
 *  - Bloquea producción por --env y por marcadores en SUPABASE_URL.
 */
import crypto from 'node:crypto';

const BLOCKED_MARKERS = ['skycrop.app', 'backend.skycrop.app'];

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

export function parseRealArgs(argv = process.argv.slice(2)) {
  const a = { env: 'test', live: false, seq: 1, runId: null, keepData: false, verbose: false };
  for (const x of argv) {
    if (x.startsWith('--env=')) a.env = x.split('=')[1].toLowerCase();
    else if (x === '--live') a.live = true;
    else if (x.startsWith('--seq=')) a.seq = Number(x.split('=')[1]) || 1;
    else if (x.startsWith('--run-id=')) a.runId = x.split('=')[1];
    else if (x === '--keep-data') a.keepData = true;
    else if (x === '--verbose' || x === '-v') a.verbose = true;
  }
  return a;
}

export function realConfig(args) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const secret = process.env.SUPABASE_JWT_SECRET || '';
  const e = String(args.env).toLowerCase();
  if (!['local', 'test', 'staging'].includes(e)) {
    throw new Error(`[REAL-GUARD] env "${args.env}" no permitido. Producción bloqueada.`);
  }
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('[REAL-GUARD] NODE_ENV=production. Abortando.');
  }
  for (const m of BLOCKED_MARKERS) {
    if (url.toLowerCase().includes(m)) throw new Error(`[REAL-GUARD] URL apunta a producción (${m}). Abortando.`);
  }
  if (args.live && (!url || !anon || !service || !secret)) {
    throw new Error('[REAL-GUARD] --live requiere SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY y JWT_SECRET del proyecto TEST/STAGING.');
  }
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const runId = args.runId || `E2E-REAL-${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${String(args.seq).padStart(3, '0')}`;
  if (!/^E2E-REAL-\d{4}-\d{2}-\d{2}-\d{3}$/.test(runId)) throw new Error(`TEST_RUN_ID inválido: ${runId}`);
  return { env: e, live: args.live, url, anon, service, secret, runId, keepData: args.keepData, verbose: args.verbose };
}

/** Firma un JWT de prueba HS256. ttlSec corto por defecto (higiene). */
export function mintTestJwt(secret, { sub, org_id, ttlSec = 3600, expired = false }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    org_id,
    role: 'authenticated',
    email: `${sub}@e2e.skycrop.test`,
    iat: now - 10,
    exp: expired ? now - 60 : now + ttlSec
  };
  const h = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const p = b64urlJson(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
  return { token: `${h}.${p}.${b64url(sig)}`, payload };
}

export function verifyTestJwt(secret, token) {
  const [h, p, s] = String(token).split('.');
  const expect = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
  if (s !== expect) throw new Error('firma inválida');
  const payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  if (payload.exp * 1000 < Date.now()) {
    const e = new Error('TokenExpiredError');
    e.name = 'TokenExpiredError';
    throw e;
  }
  return payload;
}

/** Cliente PostgREST mínimo sobre fetch nativo. Devuelve {status, body}. */
export async function rest(cfg, { table, method = 'GET', jwt = null, service = false, query = '', body = null, prefer = null, timeoutMs = 10000 }) {
  const key = service ? cfg.service : cfg.anon;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (service) headers.Authorization = `Bearer ${cfg.service}`;
  else if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (prefer) headers.Prefer = prefer;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}${query}`, {
      method, headers, signal: ctrl.signal, body: body ? JSON.stringify(body) : null
    });
    const text = await res.text().catch(() => '');
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { _raw: text.slice(0, 300) }; }
    return { status: res.status, body: parsed };
  } finally {
    clearTimeout(t);
  }
}

export async function rpc(cfg, { fn, jwt = null, service = false, body = {} }) {
  return rest(cfg, { table: `rpc/${fn}`, method: 'POST', jwt, service, body });
}

/** Storage (bucket privado). kind: 'put' | 'get' | 'remove'. */
export async function storage(cfg, { bucket, path, jwt = null, service = false, bytes = null, contentType = 'image/jpeg', kind = 'put' }) {
  const key = service ? cfg.service : cfg.anon;
  const headers = { apikey: key };
  if (service) headers.Authorization = `Bearer ${cfg.service}`;
  else if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const base = `${cfg.url}/storage/v1/object`;
  if (kind === 'put') {
    headers['Content-Type'] = contentType;
    const res = await fetch(`${base}/${bucket}/${path}`, { method: 'POST', headers, body: bytes });
    return { status: res.status, body: await res.text().catch(() => '') };
  }
  if (kind === 'get') {
    const res = await fetch(`${base}/${bucket}/${path}`, { method: 'GET', headers });
    const buf = Buffer.from(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
    return { status: res.status, bytes: buf.length };
  }
  const res = await fetch(`${base}/${bucket}`, {
    method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] })
  });
  return { status: res.status, body: await res.text().catch(() => '') };
}

/** Clasifica una respuesta como ALLOW o DENY según el verbo. */
export function verdictOf({ method, status, body }) {
  if (method === 'GET') {
    if (status === 200 && Array.isArray(body)) return 'ALLOW';
    if (status === 401 || status === 403) return 'DENY';
    return 'DENY';
  }
  if (status >= 200 && status < 300) return 'ALLOW';
  return 'DENY'; // 400 (CHECK/FK) y 401/403/404-RLS cuentan como rechazo controlado
}

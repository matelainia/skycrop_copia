/**
 * SKYCROP E2E — Cliente HTTP con métricas, reintentos y resiliencia (spec §14).
 *
 * Registra duration_ms + http_status por operación y soporta:
 *  - timeout configurable
 *  - reintento con backoff en 429/5xx (idempotencia vía X-Request-Id)
 *  - payloads incompletos/corruptos como casos negativos esperados
 */
import crypto from 'node:crypto';

export async function apiCall(ctx, { method = 'GET', path = '/health', body = null, token = null, timeoutMs = 8000, retries = 1, extraHeaders = {} }) {
  const url = `${ctx.backendUrl.replace(/\/$/, '')}${path}`;
  const requestId = crypto.randomUUID();
  let attempt = 0;
  let lastError = null;
  const t0 = Date.now();
  while (attempt <= retries) {
    attempt += 1;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extraHeaders
        },
        body: body ? JSON.stringify(body) : null
      });
      clearTimeout(t);
      const text = await res.text().catch(() => '');
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text.slice(0, 500) }; }
      // Reintentar 429/5xx con backoff lineal (evita doble insert: mismo X-Request-Id)
      if ((res.status === 429 || res.status >= 500) && attempt <= retries) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
        continue;
      }
      return { http_status: res.status, body: json, duration_ms: Date.now() - t0, requestId, attempts: attempt };
    } catch (e) {
      clearTimeout(t);
      lastError = e;
      if (attempt <= retries) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
        continue;
      }
      const err = new Error(`NETWORK_FAILURE ${method} ${path}: ${e.message}`);
      err.code = e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_FAILURE';
      err.http_status = null;
      throw err;
    }
  }
  throw lastError;
}

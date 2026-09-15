import express from 'express';
import { legacyCreateProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { Webhook } from 'svix';

// Cargar variables de entorno localmente si están disponibles
dotenv.config();

const app = express();

// --- CONFIGURACIÓN DE CLERK Y JWT DE SUPABASE ---
const isProduction = process.env.NODE_ENV === 'production';

function requireSecret(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (!isProduction && devFallback) {
    console.warn(`[CONFIG] [DEV] ${name} no configurada. Usando fallback de desarrollo.`);
    return devFallback;
  }
  throw new Error(
    `[CONFIG] La variable de entorno ${name} es obligatoria en producción. Configúrala antes de desplegar.`
  );
}

const clerkClient = createClerkClient({
  secretKey: requireSecret('CLERK_SECRET_KEY', 'sk_test_mock_secret_key_for_local_development'),
  publishableKey: requireSecret('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_mock_publishable_key'),
});

const supabaseJwtSecret = requireSecret(
  'SUPABASE_JWT_SECRET',
  'super-secret-supabase-jwt-key-change-me-in-prod'
);
const jwtCache = new Map();

function getCachedSupabaseToken(userId) {
  const cached = jwtCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[JWT CACHE HIT] Reutilizando token de Supabase para usuario: ${userId}`);
    return cached.token;
  }
  return null;
}

function cacheSupabaseToken(userId, token, expiresInMs = 10 * 60 * 1000) {
  jwtCache.set(userId, {
    token,
    expiresAt: Date.now() + expiresInMs
  });
}

function generateSupabaseJwt(userId, email, orgId, role) {
  const payload = {
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 15, // Válido por 15 minutos
    sub: userId,
    email: email,
    role: 'authenticated',
    app_metadata: {
      provider: 'clerk',
      providers: ['clerk']
    },
    user_metadata: {},
    org_id: orgId, // Clerk organization ID string (e.g. 'org_3GSw...')
    role_name: role // Role name from company_role enum
  };

  return jwt.sign(payload, supabaseJwtSecret);
}

// Middleware global de logging para depurar peticiones
// NOTA DE SEGURIDAD: nunca loguear headers completos (contienen Bearer tokens).
app.use((req, res, next) => {
  console.log(`[REQUEST LOG] ${req.method} ${req.url}`);
  next();
});


// Obtener variables de entorno (configuradas en Vercel)
const supabaseUrl = process.env.SUPABASE_URL || 'https://gynttnymneanbziywqqr.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Inicializar cliente Supabase localmente para gestionar la caché
let supabaseDb = null;
if (supabaseUrl && supabaseAnonKey) {
  supabaseDb = createClient(supabaseUrl, supabaseAnonKey);
}

// La inicialización, caché y endpoints de Google Earth Engine (/api/gee/*)
// se han migrado de forma modular y hexagonal a src/modules/gee/


// El endpoint de Clima Inteligente /api/weather y su caché se han migrado
// de forma modular y hexagonal a src/modules/weather/ utilizando el patrón Strategy.



// =============================================================================
// ENDPOINTS MASTER DATA: PRODUCTOS FITOSANITARIOS
// Deben ir ANTES del proxy para no ser reenviados a Supabase
// =============================================================================
// Los endpoints de catálogo de productos (/api/productos/*) y de auditoría de aplicaciones (/api/auditoria/*)
// se han migrado de forma modular y hexagonal a src/modules/inventory/ y src/modules/application/ respectivamente.

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  return createClient(supabaseUrl, serviceKey);
}

// Rutas que no requieren autenticación (relativas al mount /api)
const PUBLIC_PROXY_PATTERNS = [
  /^\/storage\/v1\/object\/public\//, // Buckets públicos: URLs firmadas/públicas legítimas
  /^\/auth\/v1\//, // GoTrue (flujo de login)
  /^\/realtime\// // Supabase Realtime: autenticación propia vía apikey JWT en el upgrade
];

function setAnonAuth(req) {
  req.headers['authorization'] = `Bearer ${supabaseAnonKey}`;
  req.headers['apikey'] = supabaseAnonKey;
}

// Re-deriva un JWT de Supabase fresco a partir de sub + org_id verificados.
// H-03: la columna canónica es company_users.role_id (nombres: 'administrador',
// 'gerente', ...; ver SupabaseAuthRepository.saveCompanyUser). Si role_id trae
// un UUID se resuelve a nombre vía `roles`. Un fallo aquí es EXPLÍCITO (null +
// 401 aguas arriba): jamás degradar a anon en operaciones con identidad.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function resolveRoleName(admin, roleId) {
  if (!roleId) return 'operario';
  if (!UUID_RE.test(String(roleId))) return String(roleId);
  const { data: rol } = await admin.from('roles').select('nombre').eq('id', roleId).maybeSingle();
  return rol?.nombre || 'operario';
}
async function mintSupabaseToken(clerkUserId, orgId, email) {
  if (!orgId) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data: company } = await admin
      .from('companies')
      .select('id')
      .eq('clerk_org_id', orgId)
      .maybeSingle();
    if (!company) return null;

    const { data: compUser } = await admin
      .from('company_users')
      .select('role_id')
      .eq('company_id', company.id)
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (!compUser) return null;

    const roleName = await resolveRoleName(admin, compUser.role_id);
    const token = generateSupabaseJwt(clerkUserId, email || '', company.id, roleName);
    cacheSupabaseToken(clerkUserId, token);
    return token;
  } catch (e) {
    console.warn('[PROXY AUTH] Error derivando token de Supabase:', e.message);
    return null;
  }
}

function rejectUnauthorized(res) {
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHENTICATED', message: 'Autenticación requerida.' }
  });
}

// Middleware para traducir el token de Clerk al token de Supabase con RLS en el Proxy
app.use('/api', async (req, res, next) => {
  if (req.path === '/webhooks/clerk' || req.path === '/auth/me' || req.path === '/auditoria/estado-aplicacion') {
    return next();
  }

  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const hasBearer =
    authHeader && authHeader.startsWith('Bearer ') && authHeader !== 'Bearer dummy-key';

  if (!hasBearer) {
    const isPublic = PUBLIC_PROXY_PATTERNS.some((re) => re.test(req.path));
    if (!isPublic && isProduction) {
      return rejectUnauthorized(res);
    }
    setAnonAuth(req);
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    // ── 1. ¿Es un JWT emitido por este backend (Supabase)? Verificación estricta ──
    let supabasePayload = null;
    try {
      supabasePayload = jwt.verify(token, supabaseJwtSecret);
    } catch (err) {
      if (err && err.name === 'TokenExpiredError') {
        console.warn('[PROXY AUTH] Supabase JWT expirado rechazado; cliente debe refrescar vía Clerk.');
      }
      supabasePayload = null;
    }

    if (supabasePayload && supabasePayload.sub) {
      // Firma válida y vigente: se reenvía tal cual (RLS de Supabase aplica)
      req.headers['authorization'] = `Bearer ${token}`;
      req.headers['apikey'] = process.env.SUPABASE_ANON_KEY || supabaseAnonKey;
      return next();
    }

    // ── 2. Token de Clerk: verificar firma estrictamente ──
    let requestState;
    try {
      requestState = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY
      });
    } catch (verifyErr) {
      if (isProduction) {
        console.warn('[PROXY AUTH] Token inválido rechazado en producción:', verifyErr.message);
        return rejectUnauthorized(res);
      }
      // Solo desarrollo: compatibilidad con secret keys ficticias
      requestState = jwt.decode(token);
    }

    if (requestState && requestState.sub) {
      const clerkUserId = requestState.sub;
      let supabaseToken = getCachedSupabaseToken(clerkUserId);

      if (!supabaseToken) {
        const orgId = requestState.org_id || requestState.orgId || requestState.o?.id;
        supabaseToken = await mintSupabaseToken(clerkUserId, orgId, requestState.email);
      }

      if (supabaseToken) {
        req.headers['authorization'] = `Bearer ${supabaseToken}`;
        req.headers['apikey'] = process.env.SUPABASE_ANON_KEY || supabaseAnonKey;
      } else {
        // H-03: identidad verificada sin tenant/membresía = 401 explícito.
        // Degradar a anon ocultaría el fallo y mostraría UI vacía.
        console.warn(`[PROXY AUTH] Clerk válido sin membresía (sub=${clerkUserId}). 401 explícito.`);
        return rejectUnauthorized(res);
      }
      return next();
    }

    if (isProduction) return rejectUnauthorized(res);
    setAnonAuth(req);
    return next();
  } catch (err) {
    console.warn('[PROXY AUTH] Error procesando token:', err.message);
    if (isProduction) return rejectUnauthorized(res);
    setAnonAuth(req);
    return next();
  }
});

// Middleware de Proxy para interceptar peticiones a Supabase (usando interfaz legacy)
app.use('/api', legacyCreateProxyMiddleware({
  target: supabaseUrl,
  changeOrigin: true,
  // WebSocket tunneling para Supabase Realtime (/realtime/v1/websocket).
  // Sin ws:true los upgrades fallan y generan ECONNRESET en peticiones concurrentes.
  ws: true,
  // Sin keep-alive reutilizado: evita resets por sockets estancados hacia Supabase.
  agent: false,
  httpsAgent: false,
  proxyTimeout: 30000,
  timeout: 30000,
  pathRewrite: {
    '^/api': '', // Quitar el prefijo /api antes de redirigir a Supabase
  },
  onProxyReq: (proxyReq, req, res) => {
    // Reemplazar la API key de prueba por la clave real de Supabase
    proxyReq.setHeader('apikey', supabaseAnonKey);

    const auth = req.headers['authorization'];
    if (!auth || auth === 'Bearer dummy-key' || auth.includes('sk_test') || auth.includes('pk_test')) {
      proxyReq.setHeader('authorization', `Bearer ${supabaseAnonKey}`);
    } else {
      proxyReq.setHeader('authorization', auth);
    }

    // Evitar problemas de compresión en las respuestas
    proxyReq.setHeader('accept-encoding', 'identity');

    // express.json() en app.js ya consumió el stream; reenviar body parseado
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method) && Object.keys(req.body).length) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res) => {
    console.error('Error en el proxy de Supabase:', err.message);
    // En upgrades WebSocket no siempre hay res HTTP utilizable
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.status(502).json({ error: 'Proxy Error', message: err.message });
    }
  }
}));

// Exportar para Vercel
export default app;

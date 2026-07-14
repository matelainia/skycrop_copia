import express from 'express';
import cors from 'cors';
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
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || 'sk_test_mock_secret_key_for_local_development',
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_mock_publishable_key',
});

const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || 'super-secret-supabase-jwt-key-change-me-in-prod';
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
app.use((req, res, next) => {
  console.log(`[REQUEST LOG] ${req.method} ${req.url}`);
  console.log('Headers recibidos:', req.headers);
  next();
});

// Configurar CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://skycrop.app',
  'https://www.skycrop.app',
  'https://backend.skycrop.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (como apps móviles, curl o llamadas del mismo servidor)
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'apikey',
    'X-Client-Info',
    'x-client-info',
    'Prefer',
    'Range',
    'Accept-Encoding',
    'accept-profile',
    'content-profile',
    'x-retry-count'
  ]
}));

// Obtener variables de entorno (configuradas en Vercel)
const supabaseUrl = process.env.SUPABASE_URL || 'https://fxcasqkwkiytbckvtgag.supabase.co';
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

// Middleware para traducir el token de Clerk al token de Supabase con RLS en el Proxy
app.use('/api', async (req, res, next) => {
  if (req.path === '/webhooks/clerk' || req.path === '/auth/me' || req.path === '/auditoria/estado-aplicacion') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ') && authHeader !== 'Bearer dummy-key') {
    const clerkToken = authHeader.split(' ')[1];

    try {
      const requestState = await verifyToken(clerkToken, {
        secretKey: process.env.CLERK_SECRET_KEY || 'sk_test_mock_secret_key_for_local_development'
      });
      const clerkUserId = requestState.sub;

      let supabaseToken = getCachedSupabaseToken(clerkUserId);

      if (!supabaseToken) {
        const orgId = requestState.org_id || requestState.orgId;

        if (orgId) {
          const { data: compUser } = await getSupabaseAdmin()
            .from('company_users')
            .select('role')
            .eq('company_id', orgId)
            .eq('clerk_user_id', clerkUserId)
            .single();

          if (compUser) {
            supabaseToken = generateSupabaseJwt(
              clerkUserId,
              requestState.email || '',
              orgId,
              compUser.role
            );
            cacheSupabaseToken(clerkUserId, supabaseToken);
          }
        }
      }

      if (supabaseToken) {
        req.headers['authorization'] = `Bearer ${supabaseToken}`;
        req.headers['apikey'] = process.env.SUPABASE_ANON_KEY;
      }
    } catch (err) {
      console.warn('[PROXY AUTH] Error traduciendo token de Clerk:', err.message);
      return res.status(401).json({ error: 'Token de autenticación inválido o expirado.' });
    }
  }

  next();
});


// Middleware de Proxy para interceptar peticiones a Supabase (usando interfaz legacy)
app.use('/api', legacyCreateProxyMiddleware({
  target: supabaseUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Quitar el prefijo /api antes de redirigir a Supabase
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('--- NUEVA PETICION PROXY ---');
    console.log('URL original:', req.url);
    console.log('Headers recibidos:', req.headers);

    // Reemplazar la API key de prueba por la clave real de Supabase
    const apiKey = req.headers['apikey'];
    if (apiKey === 'dummy-key' || !apiKey) {
      proxyReq.setHeader('apikey', supabaseAnonKey);
    }

    // Si la autorización es con la dummy key, reemplazarla por la real.
    // Si no hay cabecera de autorización (usuario no autenticado), no enviamos nada
    // para evitar errores con claves que no son JWT (ej. sb_publishable_*).
    const auth = req.headers['authorization'];
    if (auth === 'Bearer dummy-key') {
      proxyReq.setHeader('authorization', `Bearer ${supabaseAnonKey}`);
    } else if (auth) {
      // Si el cliente envía un JWT real de usuario, nos aseguramos de mantenerlo
      proxyReq.setHeader('authorization', auth);
    }

    // Evitar problemas de compresión en las respuestas
    proxyReq.setHeader('accept-encoding', 'identity');

    console.log('Headers enviados a Supabase:', proxyReq.getHeaders());
  },
  onError: (err, req, res) => {
    console.error('Error en el proxy de Supabase:', err);
    res.status(500).json({ error: 'Proxy Error', message: err.message });
  }
}));

// Exportar para Vercel
export default app;

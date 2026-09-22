import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import legacyApp from '../api/legacy.js';
import { auditMiddleware } from './shared/audit/auditMiddleware.js';
import { optionalAuth } from './shared/middleware/authenticate.js';
import { errorHandler } from './shared/middleware/errorHandler.js';

import { authRouter } from './modules/auth/infrastructure/adapters/inbound/ExpressAuthRouter.js';
import { weatherRouter } from './modules/weather/infrastructure/adapters/inbound/ExpressWeatherRouter.js';
import { geeRouter } from './modules/gee/infrastructure/adapters/inbound/ExpressGeeRouter.js';
import { productRouter } from './modules/inventory/infrastructure/adapters/inbound/ExpressProductRouter.js';
import { applicationAuditRouter } from './modules/application/infrastructure/adapters/inbound/ExpressApplicationAuditRouter.js';
import { agronomyRouter } from './modules/agronomy/infrastructure/adapters/inbound/ExpressAgronomyRouter.js';
import { evaluationRouter } from './modules/evaluation/infrastructure/adapters/inbound/ExpressEvaluationRouter.js';
import { fertilizationRouter } from './modules/fertilization/infrastructure/adapters/inbound/ExpressFertilizationRouter.js';
import { harvestRouter } from './modules/harvest/infrastructure/adapters/inbound/ExpressHarvestRouter.js';
import { traceabilityRouter } from './modules/traceability/infrastructure/adapters/inbound/ExpressTraceabilityRouter.js';
import { costsRouter } from './modules/costs/infrastructure/adapters/inbound/ExpressCostsRouter.js';
import { subscribeCostsEvents } from './modules/costs/infrastructure/CostsEventSubscriber.js';
import { subscribeTraceabilityEvents } from './modules/traceability/infrastructure/TraceabilityEventSubscriber.js';

const app = express();

// Configurar CORS global
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://skycrop.app',
  'https://www.skycrop.app',
  'https://backend.skycrop.app'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como apps móviles, curl o llamadas del mismo servidor)
      if (
        !origin ||
        allowedOrigins.indexOf(origin) !== -1 ||
        /^http:\/\/localhost(:\d+)?$/.test(origin)
      ) {
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
      'X-Request-Id',
      'x-request-id',
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
  })
);

// ── Security headers (defensa en profundidad, mínimo impacto) ───────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(), camera=(), geolocation=(self)');
  res.setHeader('X-XSS-Protection', '0'); // Desactivar viejo filtro, CSP es la defensa moderna
  // HSTS solo en producción + HTTPS (evitar romper http://localhost)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  // CSP mínima compatible con Swagger UI + Clerk + Supabase Maps
  // No se aplica a /api/docs que ya tiene su propio HTML, ni a assets estáticos
  if (!req.path.startsWith('/api-docs') && !req.path.startsWith('/api/swagger.json')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://*.clerk.accounts.dev https://*.clerk.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co https://*.clerk.accounts.dev https://*.clerk.com https://nominatim.openstreetmap.org; font-src 'self' https://fonts.gstatic.com data:; frame-ancestors 'none'"
    );
  }
  next();
});

// Middlewares globales para la nueva arquitectura
// NOTA: no parsear JSON para rutas proxied a Supabase (/api/rest, /api/storage, /api/realtime, /api/auth/v1)
// porque http-proxy-middleware necesita el stream crudo; si se consume aquí se produce ECONNRESET/timeout en POST.
const jsonParser = express.json({ limit: '1mb' });
app.use((req, res, next) => {
  const proxyPrefixes = ['/api/rest', '/api/storage', '/api/realtime', '/api/auth/v1'];
  if (proxyPrefixes.some((p) => req.originalUrl.startsWith(p) || req.url.startsWith(p))) {
    return next();
  }
  return jsonParser(req, res, next);
});

// Identidad verificada (token Bearer) disponible para todos los routers modulares.
// Nunca rechaza: cada controlador decide cómo tratar peticiones sin identidad.
app.use('/api', optionalAuth);

// Log de peticiones modular
app.use((req, res, next) => {
  if (
    !req.url.startsWith('/api/v1') &&
    req.url !== '/health' &&
    req.url !== '/ready' &&
    req.url !== '/live'
  ) {
    return next();
  }
  const requestId = crypto.randomUUID?.() || Date.now().toString();
  req.headers['x-request-id'] = requestId;
  console.log(`[API Request] [ID: ${requestId}] ${req.method} ${req.url}`);
  next();
});

// Middleware de auditoría automática para mutaciones
app.use(auditMiddleware);

// --- ENDPOINTS DE SALUD (OBSERVABILIDAD) ---
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'healthy', uptime: process.uptime() },
    metadata: { timestamp: new Date().toISOString() },
    error: null
  });
});

app.get('/ready', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ready' },
    metadata: { timestamp: new Date().toISOString() },
    error: null
  });
});

app.get('/live', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'live' },
    metadata: { timestamp: new Date().toISOString() },
    error: null
  });
});

// --- DOCUMENTACIÓN DE API (SWAGGER UI) ---
app.get('/api-docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>SkyCrop API Docs</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
      <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png">
      <style>
        html { box-sizing: border-box; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = function() {
          window.ui = SwaggerUIBundle({
            url: "/api/swagger.json",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout"
          });
        };
      </script>
    </body>
    </html>
  `);
});

app.get('/api/swagger.json', (req, res) => {
  res.sendFile(path.resolve('./src/shared/docs/swagger.json'));
});

// --- REGISTRO DE RUTAS MODULARES ---
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/weather', weatherRouter);
app.use('/api/v1/gee', geeRouter);
app.use('/api/v1/productos', productRouter);
app.use('/api/v1/auditoria', applicationAuditRouter);
app.use('/api/v1/agronomia', agronomyRouter);
app.use('/api/v1/evaluaciones', evaluationRouter);
app.use('/api/v1/fertilizacion', fertilizationRouter);
app.use('/api/v1/cosechas', harvestRouter);
app.use('/api/v1/trazabilidad', traceabilityRouter);
app.use('/api/v1/costos', costsRouter);

// SkyCrop Core: el sistema es el único generador de evidencia inmutable.
try {
  subscribeTraceabilityEvents();
} catch (err) {
  console.error('[Traceability] No se pudo suscribir event_generator:', err?.message || err);
}
try {
  subscribeCostsEvents();
} catch (err) {
  console.error('[Costs] No se pudo suscribir eventos de costos:', err?.message || err);
}

// Compatibilidad hacia atrás (intersección del flujo legando antes de ir al monolito)
app.use('/api/auth', authRouter); // GET /api/auth/me -> GET /me
app.use('/api', authRouter); // POST /api/webhooks/clerk -> POST /webhooks/clerk
app.use('/api/weather', weatherRouter); // GET /api/weather -> GET /
app.use('/api/gee', geeRouter); // POST /api/gee/index -> POST /index
app.use('/api/productos', productRouter); // GET /api/productos y /api/productos/:id
app.use('/api/auditoria', applicationAuditRouter); // POST /api/auditoria/*
app.use('/api/agronomia', agronomyRouter); // GET  /api/agronomia/*
app.use('/api/evaluaciones', evaluationRouter); // POST/GET /api/evaluaciones/*
app.use('/api/fertilizacion', fertilizationRouter); // GET/POST/PATCH /api/fertilizacion/*
app.use('/api/cosechas', harvestRouter); // GET/POST /api/cosechas
app.use('/api/trazabilidad', traceabilityRouter); // GET/POST /api/trazabilidad (bitácora oficial)
app.use('/api/costos', costsRouter); // Costos de producción (eventos, resúmenes, issues)

// --- DELEGACIÓN AL MONOLITO LEGADO ---
// Todo lo que no coincida con el nuevo enrutador será resuelto por el Express heredado
app.use(legacyApp);

// --- MANEJADOR DE ERRORES GLOBAL ---
// Debe registrarse al final de todas las rutas y enrutadores
app.use(errorHandler);

export default app;

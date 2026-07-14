import express from 'express';
import crypto from 'crypto';
import path from 'path';
import legacyApp from '../api/legacy.js';
import { auditMiddleware } from './shared/audit/auditMiddleware.js';
import { errorHandler } from './shared/middleware/errorHandler.js';

import { authRouter } from './modules/auth/infrastructure/adapters/inbound/ExpressAuthRouter.js';
import { weatherRouter } from './modules/weather/infrastructure/adapters/inbound/ExpressWeatherRouter.js';
import { geeRouter } from './modules/gee/infrastructure/adapters/inbound/ExpressGeeRouter.js';
import { productRouter } from './modules/inventory/infrastructure/adapters/inbound/ExpressProductRouter.js';
import { applicationAuditRouter } from './modules/application/infrastructure/adapters/inbound/ExpressApplicationAuditRouter.js';

const app = express();

// Middlewares globales para la nueva arquitectura
app.use(express.json());

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

// Compatibilidad hacia atrás (intersección del flujo legando antes de ir al monolito)
app.use('/api/auth', authRouter); // GET /api/auth/me -> GET /me
app.use('/api', authRouter); // POST /api/webhooks/clerk -> POST /webhooks/clerk
app.use('/api/weather', weatherRouter); // GET /api/weather -> GET /
app.use('/api/gee', geeRouter); // POST /api/gee/index -> POST /index
app.use('/api/productos', productRouter); // GET /api/productos y /api/productos/:id
app.use('/api/auditoria', applicationAuditRouter); // POST /api/auditoria/*

// --- DELEGACIÓN AL MONOLITO LEGADO ---
// Todo lo que no coincida con el nuevo enrutador será resuelto por el Express heredado
app.use(legacyApp);

// --- MANEJADOR DE ERRORES GLOBAL ---
// Debe registrarse al final de todas las rutas y enrutadores
app.use(errorHandler);

export default app;

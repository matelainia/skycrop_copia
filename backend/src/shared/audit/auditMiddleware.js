import AuditService from './auditService.js';

/**
 * Middleware para auditar automáticamente todas las peticiones de escritura (mutaciones de estado)
 * registrando el payload recibido (antes) y la respuesta entregada (después).
 */
export function auditMiddleware(req, res, next) {
  const method = req.method;
  const path = req.path;

  // Solo auditamos métodos que alteren o puedan alterar el estado de la base de datos
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const originalJson = res.json;
    let responseBody = null;

    // Interceptar la respuesta para guardar el cuerpo retornado
    res.json = function (body) {
      responseBody = body;
      return originalJson.apply(this, arguments);
    };

    res.on('finish', () => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

      // Intentar extraer la identidad inyectada por middlewares de autenticación
      const userId = req.tenant?.userId || req.user?.id || req.auth?.userId || null;
      const userEmail = req.auth?.email || req.user?.email || null;
      const companyId =
        req.tenant?.companyId ||
        req.user?.company_id ||
        req.user?.empresa_id ||
        req.auth?.orgId ||
        null;

      // Sanitizar payload: nunca auditar secretos, tokens o passwords
      const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const clone = { ...obj };
        const sensitive = [
          'password',
          'token',
          'authorization',
          'secret',
          'apiKey',
          'api_key',
          'supabaseToken',
          'supabase_token',
          'jwt',
          'access_token'
        ];
        for (const k of Object.keys(clone)) {
          if (sensitive.some((s) => k.toLowerCase().includes(s.toLowerCase())))
            clone[k] = '[REDACTED]';
          else if (typeof clone[k] === 'string' && clone[k].length > 500)
            clone[k] = clone[k].slice(0, 500) + '…[TRUNCATED]';
        }
        return clone;
      };

      // C4: audit_logs.accion tiene CHECK (INSERT/UPDATE/DELETE/LOGIN/LOGOUT).
      // Antes se guardaba "METHOD path" y el INSERT fallaba siempre (evento perdido).
      const actionMap = { POST: 'INSERT', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
      const action = actionMap[method] || null;
      if (!action) return;
      // company_id es NOT NULL: sin tenant no hay registro valido; no inventar empresa.
      if (!companyId) return;
      const segments = path.split('/').filter(Boolean);
      // /api/v1/<modulo>/... -> modulo real; resto como tabla candidata
      const module = segments[2] || segments[1] || 'general';
      const tableCandidate = segments[3] || segments[2] || null;

      AuditService.log({
        userId,
        userEmail,
        companyId,
        action,
        module,
        table: tableCandidate,
        before: sanitize(req.body) || null,
        after: sanitize(responseBody),
        ip,
        endpoint: `${method} ${req.originalUrl}`
      });
    });
  }

  next();
}

export default auditMiddleware;

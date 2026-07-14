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
      const userId = req.user?.id || req.auth?.userId || null;
      const userEmail = req.user?.email || req.auth?.email || null;
      const companyId = req.user?.company_id || req.user?.empresa_id || req.auth?.orgId || null;

      AuditService.log({
        userId,
        userEmail,
        companyId,
        action: `${method} ${path}`,
        module: path.split('/')[2] || 'general',
        before: req.body || null,
        after: responseBody,
        ip,
        endpoint: `${method} ${req.originalUrl}`
      });
    });
  }

  next();
}

export default auditMiddleware;

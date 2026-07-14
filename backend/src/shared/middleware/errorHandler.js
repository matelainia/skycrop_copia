import { AppError } from '../errors/AppErrors.js';
import Logger from '../observability/logger.js';

export function errorHandler(err, req, res, _next) {
  const requestId = req.headers['x-request-id'] || 'N/A';
  const timestamp = new Date().toISOString();

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Ocurrió un error interno en el servidor.';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details || null;

    if (err.statusCode >= 500) {
      Logger.error(`[Error de Sistema] [ID: ${requestId}] ${err.message}`, {
        stack: err.stack,
        code: err.code,
        rawError: err.rawError
      });
    } else {
      Logger.warn(`[Error Operacional] [ID: ${requestId}] ${err.message}`, {
        code: err.code,
        details
      });
    }
  } else {
    // Error inesperado del sistema (ej. TypeError, ReferenceError)
    Logger.error(`[Error Crítico Inesperado] [ID: ${requestId}] ${err.message}`, {
      stack: err.stack
    });
  }

  return res.status(statusCode).json({
    success: false,
    data: null,
    metadata: {
      timestamp,
      requestId
    },
    error: {
      code: errorCode,
      message,
      ...(details && { details })
    }
  });
}

export default errorHandler;

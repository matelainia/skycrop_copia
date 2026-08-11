export class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'No autenticado. Credenciales inválidas o faltantes.') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'No autorizado. Permisos insuficientes.') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado.') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(message, rawError = null) {
    super(message, 500, 'DATABASE_ERROR', false);
    this.rawError = rawError;
  }
}

export class ExternalApiError extends AppError {
  constructor(message, serviceName, rawError = null) {
    super(`Error en servicio externo [${serviceName}]: ${message}`, 502, 'EXTERNAL_API_ERROR');
    this.serviceName = serviceName;
    this.rawError = rawError;
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit excedido (Max 5 por hora).') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'UNPROCESSABLE_ENTITY_ERROR');
    this.details = details;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = 'Todos los proveedores de IA no se encuentran disponibles en este momento.'
  ) {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

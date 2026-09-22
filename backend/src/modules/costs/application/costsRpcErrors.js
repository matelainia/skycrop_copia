import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError
} from '../../../shared/errors/AppErrors.js';

/**
 * Mapea errores de las RPCs 066 (prefijo costos/<codigo>) a HTTP (§9):
 * 400 validation_failed · 401 unauthorized · 403 forbidden · 404 event_not_found ·
 * 409 duplicate_event/invalid_status/closed_period · 422 missing_price/fx_missing/
 * unallocatable/invalid_source · 501 not_implemented.
 * Mensajes RPC nunca exponen detalles internos: se reenvían tal cual (ya son
 * controlados) sin rawError al cliente.
 */
const CODE_TO_STATUS = {
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  event_not_found: 404,
  duplicate_event: 409,
  invalid_status: 409,
  closed_period: 409,
  missing_price: 422,
  fx_missing: 422,
  unallocatable: 422,
  invalid_source: 422,
  not_implemented: 501
};

export function mapCostsRpcError(err, fallbackMessage = 'Error del motor de costos') {
  const raw = err?.message || String(err || '');
  const m = raw.match(/costos\/([a-z_]+)(?::\s*(.*))?/);
  if (!m) return new DatabaseError(fallbackMessage, err);
  const [, code, detail] = m;
  const message = detail ? `Costos: ${detail}` : `Costos: ${code}`;
  switch (CODE_TO_STATUS[code]) {
    case 400:
      return new ValidationError(message);
    case 401:
      return new AuthenticationError(message);
    case 403:
      return new AuthorizationError(message || 'No autorizado.');
    case 404:
      return new NotFoundError(message);
    case 501: {
      const e = new AppError(message, 501, 'COSTS_NOT_IMPLEMENTED');
      return e;
    }
    case 409:
    case 422: {
      const status = CODE_TO_STATUS[code];
      const e = new AppError(message, status, `COSTS_${code.toUpperCase()}`);
      e.details = { costs_code: code };
      return e;
    }
    default:
      return new DatabaseError(fallbackMessage, err);
  }
}

export function isAuthRpcError(err) {
  return /invalid\s*(api\s*)?key|jwt|expired|unauthorized|permission denied|not authorized|no api key/i.test(
    err?.message || ''
  );
}

export function isMissingRpcError(err) {
  if (!err) return false;
  if (isAuthRpcError(err)) return false; // un error de key NUNCA es "RPC ausente"
  return (
    err?.code === '42883' ||
    /costos_register_event|costos_value_event|costos_allocate_event|costos_post_event|costos_reverse_event|costos_recalculate/.test(
      err?.message || ''
    )
  );
}

export default { mapCostsRpcError, isMissingRpcError };

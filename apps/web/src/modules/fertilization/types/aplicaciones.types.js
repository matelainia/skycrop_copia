/**
 * aplicaciones.types.js
 * Tipos y constantes para el submódulo Aplicaciones de Fertilización.
 *
 * Nota de arquitectura: los valores de estado deben coincidir con la BD real.
 * No inventar estados en el frontend.
 *
 * Fuente primaria: fertilization_applications.status (pending, completed, skipped, rescheduled)
 * Fuente secundaria: aplicaciones.estado_programacion para compatibilidad histórica.
 */

// ─── Estados de aplicación de fertilización (DB: fertilization_applications) ───
export const APP_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  RESCHEDULED: 'rescheduled',
};

export const APP_STATUS_LABELS = {
  [APP_STATUS.PENDING]: 'Programada',
  [APP_STATUS.COMPLETED]: 'Completada',
  [APP_STATUS.SKIPPED]: 'Omitida',
  [APP_STATUS.RESCHEDULED]: 'Reprogramada',
};

// Variantes CSS para StatusBadge
export const APP_STATUS_VARIANT = {
  [APP_STATUS.PENDING]: 'pending',
  [APP_STATUS.COMPLETED]: 'completed',
  [APP_STATUS.SKIPPED]: 'skipped',
  [APP_STATUS.RESCHEDULED]: 'rescheduled',
};

// Legacy mapping para normalizar valores históricos / ingles simple
const LEGACY_STATUS_MAP = {
  pending: APP_STATUS.PENDING,
  programada: APP_STATUS.PENDING,
  Programada: APP_STATUS.PENDING,
  scheduled: APP_STATUS.PENDING,
  pendiente: APP_STATUS.PENDING,
  completed: APP_STATUS.COMPLETED,
  completada: APP_STATUS.COMPLETED,
  Completada: APP_STATUS.COMPLETED,
  ejecutada: APP_STATUS.COMPLETED,
  skipped: APP_STATUS.SKIPPED,
  omitida: APP_STATUS.SKIPPED,
  cancelada: APP_STATUS.SKIPPED,
  cancelled: APP_STATUS.SKIPPED,
  rescheduled: APP_STATUS.RESCHEDULED,
  reprogramada: APP_STATUS.RESCHEDULED,
  'en ejecucion': APP_STATUS.PENDING,
  'en ejecución': APP_STATUS.PENDING,
};

export function normalizeAppStatus(raw) {
  if (!raw) return APP_STATUS.PENDING;
  const key = String(raw).trim().toLowerCase();
  return LEGACY_STATUS_MAP[key] || APP_STATUS.PENDING;
}

// ─── Métodos de aplicación ───────────────────────────────────────────────────
export const APP_METHOD = {
  EDAPHIC: 'edafica',
  FOLIAR: 'foliar',
  FERTIGATION: 'fertirriego',
  DRENCH: 'drench',
};

export const APP_METHOD_LABELS = {
  [APP_METHOD.EDAPHIC]: 'Edáfica',
  [APP_METHOD.FOLIAR]: 'Foliar',
  [APP_METHOD.FERTIGATION]: 'Fertirriego',
  [APP_METHOD.DRENCH]: 'Drench',
};

export function normalizeMethod(raw) {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (['edafica', 'edáfica', 'suelo', 'granular', 'voleo'].includes(v)) return APP_METHOD.EDAPHIC;
  if (['foliar', 'foliar spray', 'aspersión'].includes(v)) return APP_METHOD.FOLIAR;
  if (['fertirriego', 'fertigation', 'riego', 'fertirrigacion'].includes(v)) return APP_METHOD.FERTIGATION;
  return raw;
}

export function getMethodLabel(raw) {
  const norm = normalizeMethod(raw);
  return APP_METHOD_LABELS[norm] || (raw ? String(raw).charAt(0).toUpperCase() + String(raw).slice(1) : '—');
}

// ─── Nutrientes conocidos ───────────────────────────────────────────────────
export const KNOWN_NUTRIENTS = ['N', 'P', 'P2O5', 'K', 'K2O', 'Ca', 'Mg', 'S', 'Fe', 'Zn', 'B', 'Mn', 'Cu', 'Mo'];

// ─── Definición de columnas de tabla ────────────────────────────────────────
export const APLICACIONES_COLUMNS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'lote', label: 'Lote / Sector' },
  { key: 'cultivo', label: 'Cultivo' },
  { key: 'fase', label: 'Fase Fenológica' },
  { key: 'fertilizantes', label: 'Fertilizantes Aplicados' },
  { key: 'metodo', label: 'Método' },
  { key: 'nutrientes', label: 'Nutrientes (kg)' },
  { key: 'estado', label: 'Estado' },
  { key: 'acciones', label: 'Acciones' },
];

/**
 * @typedef {Object} AplicacionViewModel
 * @property {string} id
 * @property {string} planId
 * @property {string} fecha - ISO date (scheduled_date || completed_date)
 * @property {string} fechaFormatted - dd/MM/yyyy
 * @property {string} loteNombre
 * @property {string} sectorNombre
 * @property {string} loteSectorLabel
 * @property {string} cultivo
 * @property {string} faseFenologica
 * @property {string[]} fertilizantes - nombres
 * @property {string} metodo
 * @property {string} metodoLabel
 * @property {Object} nutrientes - {N, P, K, ...}
 * @property {string} estado
 * @property {string} estadoLabel
 * @property {string} estadoVariant
 * @property {Object} raw - fila original
 */

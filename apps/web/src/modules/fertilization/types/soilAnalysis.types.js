/**
 * soilAnalysis.types.js
 * Tipos y constantes del módulo Análisis de Suelos.
 * Cero mocks — solo definiciones y helpers de normalización.
 */

// ─── Estados ─────────────────────────────────────────────────────────────────
export const SOIL_STATUS = {
  borrador: 'borrador',
  completo: 'completo',
  archivado: 'archivado',
  anulado: 'anulado',
};

export const SOIL_STATUS_LABELS = {
  borrador: 'Borrador',
  completo: 'Completado',
  archivado: 'Archivado',
  anulado: 'Anulado',
};

export const SOIL_STATUS_VARIANTS = {
  borrador: 'draft',
  completo: 'completed',
  archivado: 'archived',
  anulado: 'anulado',
};

// ─── Métodos de muestreo ────────────────────────────────────────────────────
export const SAMPLING_METHODS = [
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'aleatorio', label: 'Aleatorio' },
  { value: 'sistematico', label: 'Sistemático' },
  { value: 'estratificado', label: 'Estratificado' },
  { value: 'otro', label: 'Otro' },
];

export const SAMPLING_METHOD_LABELS = Object.fromEntries(
  SAMPLING_METHODS.map((m) => [m.value, m.label])
);

// ─── Helpers de normalización ──────────────────────────────────────────────
export function normalizeSoilStatus(raw) {
  if (!raw) return 'borrador';
  const v = String(raw).toLowerCase();
  if (SOIL_STATUS[v]) return v;
  if (v === 'active' || v === 'completed' || v === 'completo') return 'completo';
  if (v === 'draft') return 'borrador';
  if (v === 'inactive') return 'archivado';
  return 'borrador';
}

export function getSoilStatusLabel(status) {
  return SOIL_STATUS_LABELS[normalizeSoilStatus(status)] || status;
}

export function getSoilStatusVariant(status) {
  return SOIL_STATUS_VARIANTS[normalizeSoilStatus(status)] || 'draft';
}

export function normalizeSamplingMethod(raw) {
  if (!raw) return null;
  const v = String(raw).toLowerCase();
  if (SAMPLING_METHOD_LABELS[v]) return v;
  return 'otro';
}

// ─── GPS helpers ───────────────────────────────────────────────────────────
export function formatCoordinate(value, isLat = true) {
  if (value == null || isNaN(Number(value))) return '—';
  const n = Number(value);
  const dir = isLat ? (n >= 0 ? 'N' : 'S') : (n >= 0 ? 'E' : 'W');
  return `${Math.abs(n).toFixed(6)}° ${dir}`;
}

// ─── ViewModel shape (JSDoc) ───────────────────────────────────────────────
/**
 * @typedef {Object} SoilAnalysisViewModel
 * @property {string} id
 * @property {string|null} predioId
 * @property {string} predioNombre
 * @property {string|null} loteId
 * @property {string} loteNombre
 * @property {string|null} loteCodigo
 * @property {string|null} cultivo
 * @property {string|null} laboratorioId
 * @property {string} laboratorioNombre
 * @property {string|null} laboratorioCert
 * @property {string|null} codigoMuestra
 * @property {string|null} nombreMuestra
 * @property {string|null} fechaMuestreo
 * @property {string|null} fechaRecepcion
 * @property {string} fechaAnalisis
 * @property {string} fechaAnalisisFormatted
 * @property {string|null} muestreador
 * @property {string|null} metodoMuestreo
 * @property {string} metodoMuestreoLabel
 * @property {number|null} profundidadMin
 * @property {number|null} profundidadMax
 * @property {string} profundidadLabel
 * @property {string|null} observaciones
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {number|null} accuracyM
 * @property {number|null} altitude
 * @property {string|null} capturedAt
 * @property {string|null} ubicacionNombre
 * @property {string|null} ubicacionDescripcion
 * @property {boolean} hasGps
 * @property {string|null} archivoPath
 * @property {string|null} archivoNombre
 * @property {number|null} archivoSize
 * @property {string|null} archivoMime
 * @property {boolean} hasPdf
 * @property {string} estado
 * @property {string} estadoLabel
 * @property {string} estadoVariant
 * @property {number} resultadosCount
 * @property {Array<{codigo:string, valor:number, unidad:string}>} resultadosPreview
 * @property {string|null} createdAt
 */

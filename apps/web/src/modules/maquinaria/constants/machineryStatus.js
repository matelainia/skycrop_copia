/**
 * Fuente única de verdad para estados de maquinaria (H-04).
 *
 * Doctrina label ≠ valor persistido:
 * - VALOR CANÓNICO (DB, contrato 052 + trigger mq_check_transicion_estado):
 *   'Disponible' | 'Operando' | 'Mantenimiento' | 'Fuera de servicio'
 * - ETIQUETA UI: 'En mantenimiento' para Mantenimiento (texto histórico de la
 *   interfaz); el resto coincide con el valor.
 *
 * Toda comparación debe usar el valor normalizado (normalizeMachineryStatus)
 * o las constantes MACHINERY_STATUS. Jamás comparar strings literales.
 */

export const MACHINERY_STATUS = {
  DISPONIBLE: 'Disponible',
  OPERANDO: 'Operando',
  MANTENIMIENTO: 'Mantenimiento',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
};

export const MACHINERY_STATUS_LIST = Object.values(MACHINERY_STATUS);

/** Etiquetas de interfaz por valor canónico. */
export const MACHINERY_STATUS_LABELS = {
  [MACHINERY_STATUS.DISPONIBLE]: 'Disponible',
  [MACHINERY_STATUS.OPERANDO]: 'Operando',
  [MACHINERY_STATUS.MANTENIMIENTO]: 'En mantenimiento',
  [MACHINERY_STATUS.FUERA_DE_SERVICIO]: 'Fuera de servicio',
};

/** Alias legacy/variantes que pueden llegar de filas antiguas o payloads. */
const STATUS_ALIASES = {
  'en mantenimiento': MACHINERY_STATUS.MANTENIMIENTO,
  mantenimiento: MACHINERY_STATUS.MANTENIMIENTO,
  'fuera de servicio': MACHINERY_STATUS.FUERA_DE_SERVICIO,
  'fuera de servicio ': MACHINERY_STATUS.FUERA_DE_SERVICIO,
  disponible: MACHINERY_STATUS.DISPONIBLE,
  operando: MACHINERY_STATUS.OPERANDO,
  'en operación': MACHINERY_STATUS.OPERANDO,
  'en operacion': MACHINERY_STATUS.OPERANDO,
};

export function normalizeMachineryStatus(status) {
  if (status === null || status === undefined) return status;
  const key = String(status).trim().toLowerCase();
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  // 'Fuera de Servicio' (S mayúscula, escrita por registrar_incidencia 052:726)
  if (key === 'fuera de servicio') return MACHINERY_STATUS.FUERA_DE_SERVICIO;
  return String(status).trim();
}

export function getMachineryStatusLabel(status) {
  const normalized = normalizeMachineryStatus(status);
  return MACHINERY_STATUS_LABELS[normalized] || String(status ?? '');
}

/** Comparación segura: normaliza ambos lados antes de comparar. */
export function isMachineStatus(status, canonical) {
  return normalizeMachineryStatus(status) === normalizeMachineryStatus(canonical);
}

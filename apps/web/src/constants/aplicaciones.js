// ─────────────────────────────────────────────────────────────────────────────
// aplicaciones.js — Constantes de estados para aplicaciones fitosanitarias
//
// Los valores del enum están en minúscula inglesa para ser i18n-safe.
// La base de datos NUNCA almacena el texto en español.
// Solo ESTADOS_LABELS contiene el texto visible en la UI (cambiar aquí para i18n).
// ─────────────────────────────────────────────────────────────────────────────

/** Enum de estados — estos son los valores que van a Supabase */
export const ESTADOS_APLICACION = {
  PROGRAMADA:  'programada',
  PREPARACION: 'preparacion',
  EJECUTADA:   'ejecutada',
  CANCELADA:   'cancelada',
};

/** Etiquetas UI — solo aquí se usa el idioma activo */
export const ESTADOS_LABELS = {
  programada:   'Programada',
  preparacion:  'En preparación',
  ejecutada:    'Ejecutada',
  cancelada:    'Cancelada',
};

/** Configuración visual por estado (colores, emoji) */
export const ESTADOS_UI_CONFIG = {
  programada: {
    key:    'programada',
    label:  'Programada',
    emoji:  '🟡',
    color:  '#f59e0b',
    bg:     'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
  },
  preparacion: {
    key:    'preparacion',
    label:  'En preparación',
    emoji:  '🔵',
    color:  '#3b82f6',
    bg:     'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.35)',
  },
  ejecutada: {
    key:    'ejecutada',
    label:  'Ejecutada',
    emoji:  '🟢',
    color:  '#22c55e',
    bg:     'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.35)',
  },
  cancelada: {
    key:    'cancelada',
    label:  'Cancelada',
    emoji:  '🔴',
    color:  '#ef4444',
    bg:     'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
  },
};

/**
 * Transiciones permitidas.
 * Estados finales → array vacío (bloqueados en UI y handler).
 */
export const TRANSICIONES_VALIDAS = {
  [ESTADOS_APLICACION.PROGRAMADA]:  [ESTADOS_APLICACION.PREPARACION, ESTADOS_APLICACION.CANCELADA],
  [ESTADOS_APLICACION.PREPARACION]: [ESTADOS_APLICACION.EJECUTADA,   ESTADOS_APLICACION.CANCELADA],
  [ESTADOS_APLICACION.EJECUTADA]:   [],
  [ESTADOS_APLICACION.CANCELADA]:   [],
};

/**
 * Normaliza estados legacy (Supabase puede tener valores en español/mayúscula
 * de versiones anteriores del código).
 */
export const normalizarEstado = (estado) => {
  if (!estado) return ESTADOS_APLICACION.PROGRAMADA;
  const map = {
    // Legacy (español con mayúscula)
    'Programada':     ESTADOS_APLICACION.PROGRAMADA,
    'En preparación': ESTADOS_APLICACION.PREPARACION,
    'En preparacion': ESTADOS_APLICACION.PREPARACION,
    'Ejecutada':      ESTADOS_APLICACION.EJECUTADA,
    'Cancelada':      ESTADOS_APLICACION.CANCELADA,
    // Nuevo formato (minúscula)
    'programada':     ESTADOS_APLICACION.PROGRAMADA,
    'preparacion':    ESTADOS_APLICACION.PREPARACION,
    'ejecutada':      ESTADOS_APLICACION.EJECUTADA,
    'cancelada':      ESTADOS_APLICACION.CANCELADA,
  };
  return map[estado] || ESTADOS_APLICACION.PROGRAMADA;
};

/**
 * Definición de pestañas de la vista principal.
 * estados: null = sin filtro (mostrar todas)
 */
export const TABS_APLICACIONES = [
  {
    key:     'activas',
    label:   'Activas',
    estados: [ESTADOS_APLICACION.PROGRAMADA, ESTADOS_APLICACION.PREPARACION],
  },
  {
    key:     'ejecutadas',
    label:   'Ejecutadas',
    estados: [ESTADOS_APLICACION.EJECUTADA],
  },
  {
    key:     'canceladas',
    label:   'Canceladas',
    estados: [ESTADOS_APLICACION.CANCELADA],
  },
  {
    key:     'todas',
    label:   'Todas',
    estados: null,
  },
];

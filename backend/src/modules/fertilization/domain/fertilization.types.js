/**
 * fertilization.types.js
 * Tipos y constantes del dominio de Fertilización.
 * Equivalente JS de los ENUMs definidos en la migración SQL.
 */

// ─── Estados del plan ─────────────────────────────────────────────────────────
export const PLAN_STATUS = /** @type {const} */ ({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
});

export const PLAN_STATUS_LABELS = {
  draft: 'Borrador',
  active: 'En ejecución',
  paused: 'Pausado',
  completed: 'Completado',
  archived: 'Archivado'
};

// ─── Vigencia del plan ─────────────────────────────────────────────────────────
export const VALIDITY_STATUS = /** @type {const} */ ({
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  EXPIRED: 'expired',
  COMPLETED: 'completed'
});

export const VALIDITY_STATUS_LABELS = {
  scheduled: 'Programado',
  in_progress: 'Vigente',
  expired: 'Vencido',
  completed: 'Finalizado'
};

// ─── Estado de aplicaciones ───────────────────────────────────────────────────
export const APPLICATION_STATUS = /** @type {const} */ ({
  PENDING: 'pending',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  RESCHEDULED: 'rescheduled'
});

// ─── Tipos de observación ─────────────────────────────────────────────────────
export const OBSERVATION_TYPES = /** @type {const} */ ({
  NOTE: 'note',
  SYMPTOM: 'symptom',
  FOLIAR_ANALYSIS: 'foliar_analysis',
  APPLICATION: 'application',
  SOIL: 'soil',
  CLIMATE: 'climate'
});

export const OBSERVATION_TYPE_LABELS = {
  note: 'Nota',
  symptom: 'Síntoma Visual',
  foliar_analysis: 'Análisis Foliar',
  application: 'Aplicación',
  soil: 'Suelo',
  climate: 'Clima'
};

// ─── Severidad ─────────────────────────────────────────────────────────────────
export const SEVERITY = /** @type {const} */ ({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
});

// ─── Estado nutricional ───────────────────────────────────────────────────────
export const NUTRIENT_STATUS = /** @type {const} */ ({
  LOW: 'low',
  OPTIMAL: 'optimal',
  HIGH: 'high'
});

export const NUTRIENT_STATUS_LABELS = {
  low: 'Bajo',
  optimal: 'Óptimo',
  high: 'Alto'
};

// ─── Severidad de alertas ─────────────────────────────────────────────────────
export const ALERT_SEVERITY = /** @type {const} */ ({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
});

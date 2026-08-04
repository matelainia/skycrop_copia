/**
 * planModel.js
 * Transforms a single raw plan object into the UI-ready shape.
 *
 * Today: identity + derived fields computed once here (not in components).
 * Future: maps Supabase snake_case fields, resolves foreign keys, etc.
 *
 * Supabase field mapping reference (commented for future):
 *   raw.lot_name         → plan.lotName
 *   raw.lot_area_ha      → plan.lotArea (formatted as "X.X ha")
 *   raw.phenological_phase → plan.phenologicalPhase
 *   raw.last_recommendation_date → plan.lastRecommendationDate
 *   raw.last_fertilizer  → plan.lastFertilizer
 *   raw.plan_status      → plan.status
 */

const STATUS_LABELS = {
  en_curso: 'En curso',
  pendiente: 'Pendiente',
  completado: 'Completado',
  pausado: 'Pausado',
};

const STATUS_VARIANTS = {
  en_curso: 'success',
  pendiente: 'pending',
  completado: 'success',
  pausado: 'warning',
};

/**
 * @param {object} raw - A single raw plan object
 * @returns {object} UI-ready plan
 */
export function transformPlan(raw) {
  if (!raw) return null;

  return {
    ...raw,
    // Derived display fields — computed once here, used directly in components
    statusLabel: STATUS_LABELS[raw.status] ?? raw.status,
    statusVariant: STATUS_VARIANTS[raw.status] ?? 'default',
    // Lot initials for avatar placeholder (e.g. "Lote 01-Norte" → "L1")
    lotInitials: deriveLotInitials(raw.lotName),
    // Formatted date for display
    lastRecommendationFormatted: formatDate(raw.lastRecommendationDate),
  };
}

/**
 * Derives 2-character initials from a lot name.
 * "Lote 01-Norte" → "L1"
 * "Lote 03-Bajo"  → "L3"
 */
function deriveLotInitials(lotName) {
  if (!lotName) return '??';
  // Extract the number after "Lote "
  const match = lotName.match(/(\d+)/);
  if (match) return `L${match[1]}`;
  // Fallback: first 2 chars
  return lotName.slice(0, 2).toUpperCase();
}

/**
 * Formats an ISO date string for display in Spanish.
 * "2026-07-24" → "24 jul 2026"
 */
function formatDate(isoDate) {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate + 'T12:00:00'); // noon to avoid TZ shift
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

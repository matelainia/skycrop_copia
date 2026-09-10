/**
 * traceability.types.js — vocabulario UI del sistema de evidencia verificable.
 * Sin mocks: etiquetas e iconos por tipo de evento.
 */

export const EVENT_TYPE_META = Object.freeze({
  fertilization_application: { label: 'Aplicación de fertilizante', short: 'Fertilización', color: '#2e7d32', bg: '#e8f5e9', icon: '🌱' },
  sanitary_application: { label: 'Aplicación fitosanitaria', short: 'Manejo Sanitario', color: '#e65100', bg: '#fff3e0', icon: '🛡️' },
  sanitary_monitoring: { label: 'Monitoreo sanitario', short: 'Monitoreo', color: '#1565c0', bg: '#e3f2fd', icon: '🔍' },
  general_monitoring: { label: 'Monitoreo de campo', short: 'Monitoreo', color: '#1565c0', bg: '#e3f2fd', icon: '🔍' },
  nutrition_monitoring: { label: 'Monitoreo de nutrición', short: 'Monitoreo', color: '#00838f', bg: '#e0f7fa', icon: '🧪' },
  harvest_collection: { label: 'Cosecha', short: 'Cosecha', color: '#4e342e', bg: '#efebe9', icon: '🌾' },
  postharvest_process: { label: 'Proceso postcosecha', short: 'Postcosecha', color: '#5d4037', bg: '#efebe9', icon: '📦' },
  worker_activity: { label: 'Actividad de personal', short: 'Personal', color: '#4527a0', bg: '#ede7f6', icon: '👷' },
  inventory_movement: { label: 'Movimiento de inventario', short: 'Inventario', color: '#37474f', bg: '#eceff1', icon: '📋' },
  soil_analysis: { label: 'Análisis de suelo', short: 'Suelos', color: '#6d4c41', bg: '#efebe9', icon: '🧫' },
  cultural_labor: { label: 'Labor cultural', short: 'Labores Culturales', color: '#7b1fa2', bg: '#f3e5f5', icon: '✂️' },
  machinery_operation: { label: 'Operación de maquinaria', short: 'Maquinaria', color: '#455a64', bg: '#eceff1', icon: '🚜' },
  irrigation: { label: 'Riego', short: 'Riego', color: '#0277bd', bg: '#e1f5fe', icon: '💧' },
  planting: { label: 'Siembra', short: 'Siembra', color: '#33691e', bg: '#f1f8e9', icon: '🌿' },
  pruning: { label: 'Poda', short: 'Poda', color: '#6a1b9a', bg: '#f3e5f5', icon: '✂️' },
  other: { label: 'Otra actividad', short: 'Otra', color: '#616161', bg: '#f5f5f5', icon: '📌' }
});

export const MODULE_META = Object.freeze({
  fertilizacion: 'Fertilización',
  sanitario: 'Manejo Sanitario',
  monitoreo: 'Monitoreo',
  cosecha: 'Cosecha',
  postcosecha: 'Postcosecha',
  personal: 'Personal',
  inventario: 'Inventario',
  suelos: 'Análisis de Suelos',
  maquinaria: 'Maquinaria',
  riego: 'Riego',
  sistema: 'Sistema'
});

export function eventMeta(type) {
  return EVENT_TYPE_META[type] || EVENT_TYPE_META.other;
}

export function formatEventDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export function formatEventTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

export function formatEventDateTime(iso) {
  if (!iso) return '—';
  return `${formatEventDate(iso)} • ${formatEventTime(iso)}`;
}

export default { EVENT_TYPE_META, MODULE_META, eventMeta, formatEventDate, formatEventTime, formatEventDateTime };

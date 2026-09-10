/**
 * traceability.constants.js
 * Vocabulario oficial del sistema de evidencia productiva inmutable.
 * SkyCrop no registra actividades; genera evidencia verificable.
 */

export const TRACE_EVENT_TYPES = Object.freeze([
  'fertilization_application',
  'sanitary_application',
  'sanitary_monitoring',
  'general_monitoring',
  'nutrition_monitoring',
  'harvest_collection',
  'postharvest_process',
  'worker_activity',
  'inventory_movement',
  'soil_analysis',
  'cultural_labor',
  'machinery_operation',
  'irrigation',
  'planting',
  'pruning',
  'other'
]);

export const TRACE_SOURCE_MODULES = Object.freeze([
  'fertilizacion',
  'sanitario',
  'monitoreo',
  'cosecha',
  'postcosecha',
  'personal',
  'inventario',
  'suelos',
  'maquinaria',
  'riego',
  'sistema'
]);

export const TRACE_EVENT_LABELS = Object.freeze({
  fertilization_application: 'Aplicación de fertilizante',
  sanitary_application: 'Aplicación fitosanitaria',
  sanitary_monitoring: 'Monitoreo sanitario',
  general_monitoring: 'Monitoreo general',
  nutrition_monitoring: 'Monitoreo de nutrición',
  harvest_collection: 'Cosecha',
  postharvest_process: 'Proceso postcosecha',
  worker_activity: 'Actividad de personal',
  inventory_movement: 'Movimiento de inventario',
  soil_analysis: 'Análisis de suelo',
  cultural_labor: 'Labor cultural',
  machinery_operation: 'Operación de maquinaria',
  irrigation: 'Riego',
  planting: 'Siembra',
  pruning: 'Poda',
  other: 'Otra actividad'
});

export const TRACE_MODULE_LABELS = Object.freeze({
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

export const TRACE_ESTADOS = Object.freeze([
  'COMPLETADO',
  'EN_PROCESO',
  'PENDIENTE_SYNC',
  'ANULADO_SISTEMA'
]);

export default {
  TRACE_EVENT_TYPES,
  TRACE_SOURCE_MODULES,
  TRACE_EVENT_LABELS,
  TRACE_MODULE_LABELS,
  TRACE_ESTADOS
};

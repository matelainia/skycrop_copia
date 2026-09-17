/**
 * taxonomia.js — Fuente única de taxonomías de Talento Humano (F1.1 saneamiento).
 *
 * Regla: los valores aquí definidos son los ÚNICOS que el frontend produce y
 * consume. Deben coincidir con los CHECK de la migración 055 (canónicos DB).
 * No añadir sinónimos ('En Curso', 'Activo', 'Técnica', ...) sin migración DB.
 */

// Trabajador — estado activo canónico 'Activa' (vive en datos + 026 lo permite).
export const TRABAJADOR_ESTADO_ACTIVA = 'Activa';
export const TRABAJADOR_ESTADOS_UI = ['Activa', 'On Leave', 'Inactivo'];
// CHECK DB 055 (hereda 026): Activo, Activa, Inactivo, Vacaciones, Licencia, On Leave.

// Labor — kanban + archivo. 'Cancelada' existe en DB aunque sin columna dedicada.
export const LABOR_ESTADOS = ['Pendiente', 'En Progreso', 'Completada'];
export const LABOR_ESTADO_ARCHIVADA = 'Archivada';
// CHECK DB 055: Pendiente, En Progreso, Completada, Cancelada, Archivada.

// Nómina — ciclo de pago con incidentes.
export const NOMINA_ESTADOS = ['Procesando', 'Completado', 'Fallido', 'Vencida'];
// CHECK DB 055: los mismos 4.

// Curso — catálogo fitosanitario canónico DB (5 valores, ver 016).
export const CURSO_TIPOS = [
  'Fitosanitario',
  'Manejo de Agroquímicos',
  'Seguridad y Salud',
  'Primeros Auxilios',
  'Técnico Agrícola',
];

// Registro de formación — ciclo de capacitación.
export const REGISTRO_ESTADOS = ['Completada', 'En Curso', 'Vencida'];
// CHECK DB 055: los mismos 3.

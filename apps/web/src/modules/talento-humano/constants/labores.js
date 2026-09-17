import { LABOR_ESTADOS as TAX_LABOR_ESTADOS } from './taxonomia';
// Re-export canónico (F1.1): 'En Progreso' reemplaza al inválido 'En Curso'.
export const LABOR_ESTADOS = TAX_LABOR_ESTADOS;
export const TIPOS_LABOR = [
  'Cosecha', 'Siembra', 'Fumigación', 'Riego', 'Fertilización',
  'Poda', 'Mantenimiento', 'Inventario', 'Transporte', 'Otro'
];

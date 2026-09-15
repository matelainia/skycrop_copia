/**
 * Definición canónica de pestañas del módulo Maquinaria.
 *
 * La pestaña activa es estado de navegación del módulo (no páginas
 * independientes). Se persiste en localStorage y se refleja en la URL
 * como `?tab=<id>` para permitir refresh, deep-linking y pruebas E2E
 * deterministas.
 *
 * Compatibilidad: el sidebar antiguo usaba `operaciones` y
 * `mantenimientos` (plural). Se aceptan como alias y se normalizan a
 * `jornadas` y `mantenimiento` (singular, según plan UI nuevo).
 */

export const MACHINERY_TABS = [
  { id: 'flota', label: 'Flota' },
  { id: 'jornadas', label: 'Jornadas' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'combustible', label: 'Combustible' },
  { id: 'historial', label: 'Historial' },
  { id: 'costos', label: 'Costos' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'reportes', label: 'Reportes' },
];

const ALIASES = {
  operaciones: 'jornadas',
  mantenimientos: 'mantenimiento',
};

export const MACHINERY_TAB_IDS = MACHINERY_TABS.map((t) => t.id);

export function normalizeMachineryTab(tab) {
  if (!tab || typeof tab !== 'string') return 'flota';
  const lower = tab.toLowerCase();
  const aliased = ALIASES[lower] || lower;
  return MACHINERY_TAB_IDS.includes(aliased) ? aliased : 'flota';
}

export function getMachineryTabLabel(tab) {
  const normalized = normalizeMachineryTab(tab);
  return MACHINERY_TABS.find((t) => t.id === normalized)?.label || 'Flota';
}

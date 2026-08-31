/**
 * formatAplicaciones.js
 * Utilidades centralizadas de formateo para el submódulo Aplicaciones.
 */

/**
 * Formatea una fecha ISO a dd/MM/yyyy
 * @param {string|Date} iso
 * @returns {string}
 */
export function formatAppDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

/**
 * Devuelve diferencia en días como texto relativo "Hace X días" / "Hoy" / "En X días"
 * @param {string|Date} iso
 * @returns {string}
 */
export function formatRelativeDays(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    // Normalizar a medianoche para diff en días
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Hace 1 día';
    if (diff > 1) return `Hace ${diff} días`;
    if (diff === -1) return 'Mañana';
    return `En ${Math.abs(diff)} días`;
  } catch {
    return '';
  }
}

/**
 * Formatea un valor numérico de nutriente a "45.0 kg" o "—"
 * @param {number|null|undefined} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatNutrientValue(value, decimals = 1) {
  if (value === null || value === undefined || value === '' || isNaN(Number(value))) return '—';
  const n = Number(value);
  // Si es 0 explícito, mostrar 0.0 kg solo si el modelo lo registra.
  // Si es undefined/null, ya retornamos —.
  return `${n.toFixed(decimals)} kg`;
}

/**
 * Totales: formatea kg con separador colombiano
 * @param {number} value
 * @returns {string}
 */
export function formatKgCO(value) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0 kg';
  const n = Number(value);
  return `${n.toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 0 })} kg`;
}

export function formatIntegerCO(value) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('es-CO');
}

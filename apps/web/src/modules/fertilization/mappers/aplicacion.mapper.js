/**
 * aplicacion.mapper.js
 * Adapta filas Supabase → ViewModel de UI.
 * No inventa datos: si un campo no existe, deja — / null.
 */
import { normalizeAppStatus, normalizeMethod, getMethodLabel, APP_STATUS_LABELS } from '../types/aplicaciones.types.js';
import { formatAppDate } from '../utils/formatAplicaciones.js';

function pickFertilizantes(row) {
  // row puede tener product_name directo, o join a plan_items, o product_formula
  const names = [];
  if (row.product_name) names.push(row.product_name);
  // Si tiene array de fertilizantes (futura extensión) no mock
  if (Array.isArray(row.fertilizantes)) {
    row.fertilizantes.forEach((f) => {
      if (typeof f === 'string' && f.trim()) names.push(f.trim());
      else if (f?.name) names.push(f.name);
      else if (f?.product_name) names.push(f.product_name);
    });
  }
  // Si join a fertilization_plan_items
  if (row.fertilization_plan_items?.product_name && !names.includes(row.fertilization_plan_items.product_name)) {
    names.push(row.fertilization_plan_items.product_name);
  }
  // Únicos, sin vacíos
  return [...new Set(names.filter(Boolean))];
}

function pickNutrientes(row) {
  // Nutrientes pueden venir como JSONB nutrientes, o composición calculada
  // Solo exponer lo que realmente existe.
  if (row.nutrientes && typeof row.nutrientes === 'object' && !Array.isArray(row.nutrientes)) {
    // Filtrar valores nulos
    const out = {};
    Object.entries(row.nutrientes).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) {
        out[k] = Number(v);
      }
    });
    return Object.keys(out).length ? out : null;
  }
  if (row.nutrients && typeof row.nutrients === 'object') {
    const out = {};
    Object.entries(row.nutrients).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) out[k] = Number(v);
    });
    return Object.keys(out).length ? out : null;
  }
  // Si tiene nutrientes en metadata
  if (row.metadata?.nutrients) {
    const out = {};
    Object.entries(row.metadata.nutrients).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) out[k] = Number(v);
    });
    return Object.keys(out).length ? out : null;
  }
  return null;
}

/**
 * Mapea una fila raw de fertilization_applications (con joins) a ViewModel.
 * @param {object} row
 * @returns {import('../types/aplicaciones.types.js').AplicacionViewModel}
 */
export function mapAplicacionRow(row) {
  if (!row) return null;

  const plan = row.fertilization_plans || row.plan || {};
  const loteField = plan.lote_id || row.lote_id || null;

  const fechaRaw = row.completed_date || row.scheduled_date || row.fecha_aplicacion || row.created_at || null;
  const estadoNorm = normalizeAppStatus(row.status || row.estado || row.estado_programacion);
  const metodoRaw = row.application_method || row.metodo_aplicacion || row.metodo || plan.application_method || null;
  const metodoNorm = normalizeMethod(metodoRaw);

  const fertilizantes = pickFertilizantes(row);
  const nutrientes = pickNutrientes(row);

  // Lote / Sector
  const loteNombre = plan.lot_name || plan.lote_nombre || row.lote_nombre || row.loteName || null;
  const sectorNombre = plan.sector_name || row.sector_name || null;
  const loteCodigo = plan.codigo_interno || row.codigo_interno || null;

  const cultivo = plan.crop_name || row.crop_name || row.cultivo || null;
  const fase = plan.phenological_stage || row.phenological_stage || row.fase_fenologica || row.estado_fenologico || null;

  return {
    id: String(row.id),
    planId: row.plan_id ? String(row.plan_id) : null,
    loteId: loteField ? String(loteField) : null,
    fecha: fechaRaw,
    fechaFormatted: formatAppDate(fechaRaw),
    loteNombre: loteNombre || '—',
    loteCodigo: loteCodigo || null,
    sectorNombre: sectorNombre || null,
    loteSectorLabel: [loteNombre, sectorNombre].filter(Boolean).join(' · ') || '—',
    cultivo: cultivo || '—',
    cultivoRaw: cultivo || null,
    faseFenologica: fase || null,
    faseLabel: fase || '—',
    fertilizantes,
    fertilizantesLabel: fertilizantes.length ? fertilizantes.join(', ') : '—',
    metodo: metodoNorm || metodoRaw || null,
    metodoLabel: metodoRaw ? getMethodLabel(metodoRaw) : '—',
    nutrientes, // null si no hay datos
    estado: estadoNorm,
    estadoLabel: APP_STATUS_LABELS[estadoNorm] || estadoNorm,
    estadoVariant: estadoNorm,
    raw: row,
    // Campos extra para detalle
    doseApplied: row.dose_applied ?? null,
    doseUnit: row.dose_unit ?? null,
    productFormula: row.product_formula ?? null,
    completedBy: row.completed_by ?? null,
    completionNote: row.completion_note ?? null,
    scheduledDate: row.scheduled_date ?? null,
    completedDate: row.completed_date ?? null,
    applicationNumber: row.application_number ?? null,
    createdAt: row.created_at ?? null,
  };
}

/**
 * Mapea array de filas
 * @param {object[]} rows
 */
export function mapAplicacionesRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapAplicacionRow).filter(Boolean);
}

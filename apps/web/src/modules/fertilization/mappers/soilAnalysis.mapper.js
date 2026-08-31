/**
 * soilAnalysis.mapper.js
 * Adapta filas Supabase (vw_analisis_suelos_enriched o analisis_suelos) → ViewModel UI
 * Sin datos inventados: campos faltantes → null / "—"
 */
import {
  normalizeSoilStatus,
  getSoilStatusLabel,
  getSoilStatusVariant,
  normalizeSamplingMethod,
} from '../types/soilAnalysis.types.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    // iso puede ser YYYY-MM-DD o ISO completo
    const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatFechaHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function mapSoilAnalysisRow(row) {
  if (!row) return null;

  const estadoNorm = normalizeSoilStatus(row.estado);
  const hasGps = row.latitude != null && row.longitude != null;
  const hasPdf = Boolean(row.archivo_pdf_path);

  // Predio / lote nombres - vienen de vista enriquecida o directos
  const predioNombre = row.predio_nombre || row.predioNombre || row.predios?.nombre || '—';
  const loteNombre = row.lote_nombre || row.loteNombre || row.lotes?.nombre || row.nombre_muestra || row.lote_codigo || 'Sin lote';
  const loteCodigo = row.lote_codigo || row.loteCodigo || row.codigo_muestra || null;

  // Laboratorio
  const labNombre = row.laboratorio_nombre || row.laboratorioNombre || row.laboratorios?.nombre || '—';
  const labCert = row.laboratorio_cert || row.laboratorioCert || row.laboratorios?.numero_acreditacion || null;

  // Profundidad
  const min = row.profundidad_min_cm ?? row.profundidadMin ?? null;
  const max = row.profundidad_max_cm ?? row.profundidadMax ?? null;
  let profundidadLabel = '—';
  if (min != null && max != null) profundidadLabel = `${min} — ${max} cm`;
  else if (min != null) profundidadLabel = `${min} cm`;
  else if (max != null) profundidadLabel = `${max} cm`;

  // Resultados preview (desde vista jsonb o relación)
  let resultadosPreview = [];
  if (Array.isArray(row.resultados_preview)) resultadosPreview = row.resultados_preview;
  else if (Array.isArray(row.resultadosPreview)) resultadosPreview = row.resultadosPreview;
  else if (row.resultados_preview && typeof row.resultados_preview === 'string') {
    try { resultadosPreview = JSON.parse(row.resultados_preview); } catch { resultadosPreview = []; }
  }

  // Normalizar preview para pills de tabla: { codigo, valor, unidad }
  resultadosPreview = (resultadosPreview || [])
    .filter(Boolean)
    .slice(0, 6)
    .map((r) => ({
      codigo: r.codigo || r.codigo_parametro || r.parametro || '?',
      valor: Number(r.valor) || 0,
      unidad: r.unidad || '-',
    }));

  return {
    id: String(row.id),
    companyId: row.company_id || null,
    predioId: row.predio_id ? String(row.predio_id) : null,
    predioNombre,
    loteId: row.lote_id ? String(row.lote_id) : null,
    loteNombre: String(loteNombre),
    loteCodigo,
    cultivo: row.lote_cultivo || row.cultivo || row.lotes?.cultivo || null,
    variedad: row.lote_variedad || row.variedad || null,
    laboratorioId: row.laboratorio_id ? String(row.laboratorio_id) : null,
    laboratorioNombre: String(labNombre),
    laboratorioCert: labCert,
    laboratorioAcreditado: row.laboratorio_acreditado ?? row.laboratorioAcreditado ?? null,
    codigoMuestra: row.codigo_muestra || null,
    nombreMuestra: row.nombre_muestra || null,
    zonaMuestreo: row.ubicacion_nombre || row.zonaMuestreo || row.bloque || '—',
    zonaDescripcion: row.ubicacion_descripcion || null,
    fechaMuestreo: row.fecha_muestreo || null,
    fechaMuestreoFormatted: row.fecha_muestreo ? formatDate(row.fecha_muestreo) : '—',
    fechaRecepcion: row.fecha_recepcion || null,
    fechaRecepcionFormatted: row.fecha_recepcion ? formatDate(row.fecha_recepcion) : '—',
    fechaAnalisis: row.fecha_analisis || null,
    fechaAnalisisFormatted: row.fecha_analisis ? formatDate(row.fecha_analisis) : '—',
    fechaAnalisisShort: row.fecha_analisis ? formatDate(row.fecha_analisis) : '—',
    muestreador: row.muestreador || null,
    metodoMuestreo: normalizeSamplingMethod(row.metodo_muestreo),
    metodoMuestreoLabel: row.metodo_muestreo ? (row.metodo_muestreo.charAt(0).toUpperCase() + row.metodo_muestreo.slice(1)) : '—',
    profundidadMin: min != null ? Number(min) : null,
    profundidadMax: max != null ? Number(max) : null,
    profundidadLabel,
    observaciones: row.observaciones || null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    accuracyM: row.accuracy_m != null ? Number(row.accuracy_m) : (row.accuracyM != null ? Number(row.accuracyM) : null),
    altitude: row.altitude != null ? Number(row.altitude) : null,
    capturedAt: row.captured_at || null,
    capturedAtFormatted: row.captured_at ? formatFechaHora(row.captured_at) : null,
    ubicacionNombre: row.ubicacion_nombre || null,
    ubicacionDescripcion: row.ubicacion_descripcion || null,
    hasGps,
    archivoPath: row.archivo_pdf_path || null,
    archivoNombre: row.archivo_pdf_nombre || row.archivo_pdf_path?.split('/').pop() || null,
    archivoSize: row.archivo_pdf_size != null ? Number(row.archivo_pdf_size) : null,
    archivoMime: row.archivo_pdf_mime || 'application/pdf',
    hasPdf,
    estado: estadoNorm,
    estadoLabel: getSoilStatusLabel(estadoNorm),
    estadoVariant: getSoilStatusVariant(estadoNorm),
    resultadosCount: row.resultados_count != null ? Number(row.resultados_count) : (resultadosPreview.length || 0),
    resultadosPreview,
    // Para compatibilidad con diseño Figma mock (mirar tabla: pH 6.2, MO 3.1% etc)
    parametrosPrincipales: resultadosPreview,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    raw: row,
  };
}

export function mapSoilAnalysisRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapSoilAnalysisRow).filter(Boolean);
}

/**
 * Mapea detalle completo con resultados estructurados
 * @param {Object} detail - { analisis: row, resultados: array }
 */
export function mapSoilAnalysisDetail(detail) {
  if (!detail) return null;
  const analisis = mapSoilAnalysisRow(detail.analisis || detail);
  if (!analisis) return null;

  let resultados = detail.resultados || detail.results || [];
  // Si vienen de RPC jsonb, ya es array
  resultados = (Array.isArray(resultados) ? resultados : []).map((r) => ({
    id: String(r.id),
    analisisId: String(r.analisis_suelo_id || analisis.id),
    codigo: r.codigo_parametro || r.codigo || r.parametro || '?',
    parametro: r.parametro || r.codigo_parametro || '?',
    nombre: r.parametro || r.codigo_parametro || '?',
    valor: Number(r.valor),
    unidad: r.unidad || '-',
    metodo: r.metodo_analitico || null,
    nivel: r.nivel_interpretacion || null,
    observacion: r.observacion || null,
    orden: r.orden ?? 0,
    raw: r,
  }));

  // Ordenar por orden
  resultados.sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo));

  return {
    analisis,
    resultados,
    hasResults: resultados.length > 0,
  };
}

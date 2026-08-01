/**
 * buildProtocolSummary
 *
 * Función pura de dominio: única fuente de verdad para calcular
 * las métricas y el resumen de un protocolo de evaluación.
 *
 * Toda la aplicación (tarjetas de listado, panel lateral del Wizard,
 * Vista Previa, reportes, exportaciones) debe usar ESTA función
 * para evitar inconsistencias.
 *
 * Compatible con:
 *   - Protocolo ensamblado completo (con arrays de variables/umbrales/reglas)
 *   - Protocolo de listado (con propiedades num_variables, num_umbrales, num_reglas)
 *
 * @param {object} protocolo - Objeto de protocolo del dominio
 * @returns {ProtocolSummary}
 */
export function buildProtocolSummary(protocolo) {
  if (!protocolo) return _emptyProtocolSummary();

  // Conteos: prioriza arrays reales si están disponibles, luego usa campos pre-calculados
  const numVariables = Array.isArray(protocolo.variables)
    ? protocolo.variables.length
    : (protocolo.num_variables ?? 0);

  const numIndicadores = Array.isArray(protocolo.indicadores)
    ? protocolo.indicadores.length
    : (protocolo.num_indicadores ?? 0);

  const numEscalas = Array.isArray(protocolo.variables)
    ? protocolo.variables.reduce((acc, v) => acc + (Array.isArray(v.escalas) ? v.escalas.length : 0), 0)
    : (protocolo.num_escalas ?? 0);

  const numUmbrales = Array.isArray(protocolo.umbrales)
    ? protocolo.umbrales.length
    : (protocolo.num_umbrales ?? 0);

  const numReglas = Array.isArray(protocolo.reglas)
    ? protocolo.reglas.length
    : (protocolo.num_reglas ?? 0);

  // Descripción del diseño de muestreo
  const tamanio   = protocolo.tamanio_muestra;
  const unidad    = protocolo.unidad_muestreo;
  const frecuencia = protocolo.frecuencia_dias;
  const metodo    = protocolo.metodo_seleccion;

  const disenoMuestreo = [
    tamanio  && `${tamanio} ${unidad || 'unidades'}`,
    frecuencia && `cada ${frecuencia} días`,
    metodo   && `· ${metodo}`,
  ].filter(Boolean).join(' ') || '—';

  // Etiqueta del estado
  const estadoLabel = {
    borrador:  'Borrador',
    activo:    'Activo',
    archivado: 'Archivado',
    obsoleto:  'Obsoleto',
  }[protocolo.estado] || 'Desconocido';

  // Formateo de fechas
  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return {
    // Conteos de entidades
    numVariables,
    numIndicadores,
    numEscalas,
    numUmbrales,
    numReglas,

    // Versión y estado
    version:     protocolo.version || '1.0',
    estado:      protocolo.estado  || 'borrador',
    estadoLabel,

    // Diseño de muestreo (string legible)
    disenoMuestreo,
    unidadMuestreo:  protocolo.unidad_muestreo  || '—',
    tamanioMuestra:  protocolo.tamanio_muestra  ?? '—',
    frecuenciaDias:  protocolo.frecuencia_dias  ?? '—',
    metodoSeleccion: protocolo.metodo_seleccion || '—',

    // Identificación
    nombre:         protocolo.nombre            || 'Sin nombre',
    cultivo:        protocolo.cultivo_nombre    || protocolo.cultivo?.nombre_comun || '—',
    objeto:         protocolo.objeto_nombre     || protocolo.objeto_evaluacion?.nombre_comun || '—',
    tipoMonitoreo:  protocolo.tipo_monitoreo    || '—',
    responsable:    protocolo.responsable       || protocolo.created_by || '—',
    descripcion:    protocolo.descripcion       || protocolo.metodologia || '',

    // Auditoría
    creadoEn:       formatDate(protocolo.created_at),
    actualizadoEn:  formatDate(protocolo.updated_at),
    createdBy:      protocolo.created_by  || '—',
    updatedBy:      protocolo.updated_by  || '—',
    auditComentario: protocolo.audit_comentario || '',
  };
}

/**
 * Genera indicadores visuales para el resumen (colores e íconos por estado).
 */
export function buildProtocolEstadoConfig(estado) {
  const configs = {
    borrador:  { label: 'Borrador',  color: '#a16207', bg: 'rgba(234,179,8,0.12)' },
    activo:    { label: 'Activo',    color: '#15803d', bg: 'rgba(21,128,61,0.12)' },
    archivado: { label: 'Archivado', color: '#1d4ed8', bg: 'rgba(29,78,216,0.12)' },
    obsoleto:  { label: 'Obsoleto',  color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  };
  return configs[estado] || configs.borrador;
}

function _emptyProtocolSummary() {
  return {
    numVariables: 0, numEscalas: 0, numUmbrales: 0, numReglas: 0,
    version: '1.0', estado: 'borrador', estadoLabel: 'Borrador',
    disenoMuestreo: '—', unidadMuestreo: '—', tamanioMuestra: '—',
    frecuenciaDias: '—', metodoSeleccion: '—',
    nombre: 'Sin nombre', cultivo: '—', objeto: '—',
    tipoMonitoreo: '—', responsable: '—', descripcion: '',
    creadoEn: '—', actualizadoEn: '—', createdBy: '—', updatedBy: '—',
    auditComentario: '',
  };
}

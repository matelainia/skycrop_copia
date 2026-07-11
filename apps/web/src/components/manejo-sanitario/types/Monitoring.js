export const createMonitoring = (data = {}) => {
  return {
    id: data.id || '',
    lote_id: data.lote_id || '',
    tipo_monitoreo: data.tipo_monitoreo || 'Sanitario',
    fecha_monitoreo: data.fecha_monitoreo || new Date().toISOString(),
    responsable: (data.responsable || '').trim(),
    incidencia_pct: parseFloat(data.incidencia_pct) || 0,
    severidad_pct: parseFloat(data.severidad_pct) || 0,
    humedad_pct: parseFloat(data.humedad_pct) || 75,
    temperatura_c: parseFloat(data.temperatura_c) || 28,
    plagas_detectadas: data.plagas_detectadas || 'Ninguna',
    enfermedades_detectadas: data.enfermedades_detectadas || 'Ninguna',
    deficiencias_nutricionales: data.deficiencias_nutricionales || 'Ninguna',
    observaciones: data.observaciones || 'Sin novedades.',
    evidencia_foto_url: data.evidencia_foto_url || ''
  };
};

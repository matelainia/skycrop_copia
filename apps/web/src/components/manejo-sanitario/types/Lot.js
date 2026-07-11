export const createLot = (data = {}) => {
  return {
    id: data.id || '',
    codigo_interno: (data.codigo_interno || '').trim().toUpperCase(),
    nombre: (data.nombre || '').trim(),
    cultivo: data.cultivo || 'Maíz',
    variedad: (data.variedad || '').trim() || 'N/A',
    fecha_siembra: data.fecha_siembra || new Date().toISOString().split('T')[0],
    estado_fenologico: data.estado_fenologico || data.estado_fenológico || 'Vegetativo',
    sistema_productivo: data.sistema_productivo || 'Convencional',
    responsable_tecnico: (data.responsable_tecnico || '').trim() || 'Andrés Castro',
    observaciones: (data.observaciones || '').trim() || 'Sin observaciones.',
    area_ha: parseFloat(data.area_ha) || 0,
    perimetro_m: parseFloat(data.perimetro_m) || 0,
    centroide_lat: parseFloat(data.centroide_lat) || 3.518,
    centroide_lng: parseFloat(data.centroide_lng) || -76.305,
    estado_sanitario: data.estado_sanitario || 'excelente',
    ndvi_actual: parseFloat(data.ndvi_actual) || 0.75,
    ndvi_trend: data.ndvi_trend || '+0.01',
    disease_detected: data.disease_detected || 'Ninguna',
    incidence_pct: parseFloat(data.incidence_pct) || 0,
    severity_pct: parseFloat(data.severity_pct) || 0,
    trabajadores: Array.isArray(data.trabajadores) ? data.trabajadores : [],
    adjuntos: Array.isArray(data.adjuntos) ? data.adjuntos : [],
    coordinates: Array.isArray(data.coordinates) ? data.coordinates : []
  };
};

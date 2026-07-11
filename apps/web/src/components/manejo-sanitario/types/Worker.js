export const createWorkerLog = (data = {}) => {
  return {
    id: data.id || '',
    lote_id: data.lote_id || '',
    nombre: (data.nombre || '').trim(),
    fecha_ingreso: data.fecha_ingreso || new Date().toISOString(),
    actividad_realizada: (data.actividad_realizada || '').trim() || 'Labores generales',
    tiempo_permanencia_horas: parseFloat(data.tiempo_permanencia_horas) || parseFloat(data.tiempo_permanencia_hours) || 8.0,
    estado: data.estado || 'activo'
  };
};

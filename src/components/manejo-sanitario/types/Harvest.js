export const createHarvest = (data = {}) => {
  return {
    id: data.id || '',
    lote_id: data.lote_id || '',
    fecha_programada: data.fecha_programada || '',
    produccion_estimada_kg: parseFloat(data.produccion_estimada_kg) || 0,
    area_programada_ha: parseFloat(data.area_programada_ha) || 0,
    estado_carencia: data.estado_carencia || 'Sin restricciones'
  };
};

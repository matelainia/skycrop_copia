export const createCost = (data = {}) => {
  return {
    id: data.id || '',
    lote_id: data.lote_id || '',
    categoria: data.categoria || 'Aplicaciones',
    fecha: data.fecha || new Date().toISOString().split('T')[0],
    descripcion: (data.descripcion || '').trim() || 'Costo operacional registrado',
    costo: parseFloat(data.costo) || 0,
    responsable: (data.responsable || '').trim() || 'Andrés Castro'
  };
};

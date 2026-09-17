export const getHorasDeJornal = (jornal) => {
  const j = Number(jornal);
  if (j === 0.25) return 2;
  if (j === 0.5) return 4;
  if (j === 0.75) return 6;
  return 8; // Default 1.00
};

export const getLaborAssigneeName = (labor, workers = [], cuadrillas = []) => {
  if (!labor) return 'Sin asignar';
  if (labor.asignacion === 'cuadrilla') {
    const c = cuadrillas.find(c => c.id === labor.cuadrillaId);
    return c ? c.nombre : 'Cuadrilla sin nombre';
  }
  return (labor.trabajadoresIds || [])
    .map(id => {
      const w = workers.find(w => w.id === id);
      return w ? `${w.nombres} ${w.apellidos}` : '';
    })
    .filter(Boolean)
    .join(', ') || 'Sin asignar';
};

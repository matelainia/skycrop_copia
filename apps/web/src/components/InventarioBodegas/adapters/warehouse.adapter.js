export const warehouseToClient = (wh) => {
  if (!wh) return null;
  return {
    id: wh.id,
    nombre: wh.nombre,
    sector: wh.sector,
    coordenadaX: wh.coordenada_x,
    coordenadaY: wh.coordenada_y,
    categoria: wh.categoria,
    responsableId: wh.responsable_id,
    capacidad: wh.capacidad_posiciones ?? null,
    ocupacion: wh.ocupacion_usada ?? 0,
    createdAt: wh.created_at,
  };
};

export const warehouseToDatabase = (wh) => {
  if (!wh) return null;
  const selectedCategory = wh.categoria === 'Otro'
    ? wh.categoriaOtro?.trim()
    : wh.categoria;

  return {
    nombre: wh.nombre?.trim() || '',
    sector: wh.sector?.trim() || '',
    coordenada_x: wh.coordenadaX !== '' && wh.coordenadaX !== null ? Number(wh.coordenadaX) : null,
    coordenada_y: wh.coordenadaY !== '' && wh.coordenadaY !== null ? Number(wh.coordenadaY) : null,
    categoria: selectedCategory || '',
    responsable_id: wh.responsableId !== '' ? wh.responsableId : null,
    capacidad_posiciones: wh.capacidad === '' || wh.capacidad === null || wh.capacidad === undefined
      ? null
      : Number(wh.capacidad),
  };
};

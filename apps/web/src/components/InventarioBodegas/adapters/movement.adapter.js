export const movementToClient = (m) => {
  if (!m) return null;
  return {
    id: m.id,
    createdAt: m.created_at,
    itemId: m.item_id,
    cantidad: Number(m.cantidad),
    tipo: m.tipo,
    antes: Number(m.antes),
    despues: Number(m.despues),
    motivo: m.motivo || '',
    usuarioId: m.usuario_id || null,
    warehouseId: m.warehouse_id || null,
  };
};

export const movementToDatabase = (m) => {
  if (!m) return null;
  return {
    item_id: m.itemId,
    cantidad: Number(m.cantidad),
    tipo: m.tipo,
    antes: Number(m.antes),
    despues: Number(m.despues),
    motivo: m.motivo?.trim() || '',
    usuario_id: m.usuarioId || null,
    warehouse_id: m.warehouseId || null,
  };
};

export const inventoryToClient = (item) => {
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    minQuantity: item.min_quantity,
    maxQuantity: item.stock_maximo ?? null,
    sku: item.sku ?? null,
    warehouseId: item.warehouse_id,
    lote: item.lote,
    registroIca: item.registro_ica,
    comentarios: item.comentarios,
  };
};

export const inventoryToDatabase = (item) => {
  if (!item) return null;
  return {
    name: item.name?.trim() || '',
    category: item.category,
    quantity: Number(item.quantity),
    unit: item.unit,
    min_quantity: Number(item.minQuantity),
    stock_maximo: item.maxQuantity === '' || item.maxQuantity === null || item.maxQuantity === undefined
      ? null
      : Number(item.maxQuantity),
    sku: item.sku?.trim() || null,
    warehouse_id: item.warehouseId || null,
    lote: item.lote?.trim() || '',
    registro_ica: item.registroIca?.trim() || '',
    comentarios: item.comentarios?.trim() || '',
  };
};

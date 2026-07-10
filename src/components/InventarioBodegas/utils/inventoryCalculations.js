export const calculateMetrics = (items = [], warehouses = []) => {
  const totalItemsCount = items.length;
  const lowStockCount = items.filter(item => item.quantity < item.minQuantity).length;

  // Calculate dynamic Bodega Central occupancy
  const centralWh = warehouses.find(w => w.nombre.toLowerCase().includes('central'));
  const centralItems = items.filter(item => item.warehouseId === centralWh?.id);
  const totalCentralQty = centralItems.reduce((acc, item) => acc + item.quantity, 0);
  const occupancyPercentage = Math.min(100, Math.round((totalCentralQty / 500) * 100)) || 0;

  return {
    totalItemsCount,
    lowStockCount,
    warehousesCount: warehouses.length,
    occupancyPercentage
  };
};

export const getWarehouseStats = (items = [], warehouses = []) => {
  return [
    {
      id: 'all',
      name: 'Todas las Bodegas',
      location: 'General',
      count: items.length
    },
    ...warehouses.map(w => ({
      id: w.id,
      name: w.nombre,
      location: w.sector,
      categoria: w.categoria,
      coordenada_x: w.coordenadaX,
      coordenada_y: w.coordenadaY,
      coordenadaX: w.coordenadaX,
      coordenadaY: w.coordenadaY,
      responsable_id: w.responsableId,
      responsableId: w.responsableId,
      count: items.filter(item => item.warehouseId === w.id).length
    }))
  ];
};

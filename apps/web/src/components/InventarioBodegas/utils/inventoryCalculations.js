import { getStockStatus, isAlertStatus } from './inventoryStatus';

export const calculateMetrics = (items = [], warehouses = []) => {
  const totalItemsCount = items.length;
  const criticalCount = items.filter(item => isAlertStatus(getStockStatus(item))).length;

  // Ocupación global real (trigger trg_inventario_occupancy, migración 061).
  // Solo bodegas con capacidad definida; null si ninguna la tiene.
  const withCap = warehouses.filter(w => Number(w.capacidad) > 0);
  const globalOccupancy = withCap.length === 0
    ? null
    : Math.min(100, Math.round(
        withCap.reduce((acc, w) => acc + (Number(w.ocupacion) || 0), 0) /
        withCap.reduce((acc, w) => acc + Number(w.capacidad), 0) * 100
      ));

  return {
    totalItemsCount,
    lowStockCount: criticalCount,
    criticalCount,
    warehousesCount: warehouses.length,
    occupancyPercentage: globalOccupancy,
    // Compat: antes era % de "Bodega Central" con /500 hardcodeado.
    occupancyLabel: withCap.length === 0 ? 'Sin capacidad definida' : 'Ocupación global'
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
      capacidad: w.capacidad,
      ocupacion: w.ocupacion,
      occupancyPct: Number(w.capacidad) > 0
        ? Math.min(100, Math.round((Number(w.ocupacion) || 0) / Number(w.capacidad) * 100))
        : null,
      count: items.filter(item => item.warehouseId === w.id).length,
      alerts: items.filter(item => item.warehouseId === w.id && isAlertStatus(getStockStatus(item))).length
    }))
  ];
};

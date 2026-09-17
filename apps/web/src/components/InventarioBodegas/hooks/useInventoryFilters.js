import { useState, useMemo } from 'react';
import { getStockStatus, isAlertStatus } from '../utils/inventoryStatus';

// Filtros cliente: bodega + categoría + estado (la búsqueda y el orden son
// server-side vía useInventory). 'alertas' = crítico + agotado.
export function useInventoryFilters(items, statusFilter = 'todos', initials = {}) {
  const [activeWarehouse, setActiveWarehouse] = useState(initials.wh || 'all');
  const [categoryFilter, setCategoryFilter] = useState(initials.cat || 'Todos');

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const matchesWarehouse = activeWarehouse === 'all' || item.warehouseId === activeWarehouse;
      const matchesCategory = categoryFilter === 'Todos' || item.category === categoryFilter;
      if (!matchesWarehouse || !matchesCategory) return false;
      if (statusFilter === 'todos') return true;
      const st = getStockStatus(item);
      if (statusFilter === 'alertas') return isAlertStatus(st);
      return st === statusFilter;
    });
  }, [items, activeWarehouse, statusFilter, categoryFilter]);

  return {
    activeWarehouse,
    setActiveWarehouse,
    categoryFilter,
    setCategoryFilter,
    filteredItems
  };
}

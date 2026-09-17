import { useState, useEffect, useCallback } from 'react';
import * as inventoryService from '../services/inventoryService';
import { useInventoryModule } from '../context/InventoryModuleContext';

export function useInventory(query = {}) {
  const [items, setItems] = useState([]);
  const { loading, setLoading, showError } = useInventoryModule();
  const { search = '', sortKey = 'name', sortDir = 1 } = query;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inventoryService.fetchInventory({ search, sortKey, sortDir });
      setItems(data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      showError('Error al cargar el inventario: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [setLoading, showError, search, sortKey, sortDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    items,
    setItems,
    loading,
    refresh
  };
}

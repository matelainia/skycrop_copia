import { useState, useEffect, useCallback } from 'react';
import * as warehouseService from '../services/warehouseService';
import { useInventoryModule } from '../context/InventoryModuleContext';

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [workers, setWorkers] = useState([]);
  const { loading, setLoading, showError } = useInventoryModule();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [whData, workersData] = await Promise.all([
        warehouseService.fetchWarehouses(),
        warehouseService.fetchWorkers()
      ]);
      setWarehouses(whData);
      setWorkers(workersData);
    } catch (err) {
      console.error('Error fetching warehouses/workers:', err);
      showError('Error al cargar bodegas: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [setLoading, showError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    warehouses,
    workers,
    setWarehouses,
    loading,
    refresh
  };
}

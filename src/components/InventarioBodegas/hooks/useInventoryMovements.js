import { useState, useCallback } from 'react';
import * as inventoryMovementService from '../services/inventoryMovementService';
import { useInventoryModule } from '../context/InventoryModuleContext';

export function useInventoryMovements() {
  const [movements, setMovements] = useState([]);
  const { loading, setLoading, showError } = useInventoryModule();

  const getMovements = useCallback(async (itemId = null) => {
    setLoading(true);
    try {
      const data = await inventoryMovementService.fetchMovements(itemId);
      setMovements(data);
      return data;
    } catch (err) {
      console.error('Error fetching inventory movements:', err);
      // Suppress error if the table movements_inventario doesn't exist yet (graceful fallback)
      if (err.message && err.message.includes('relation "movimientos_inventario" does not exist')) {
        console.warn('The table "movimientos_inventario" does not exist. Please run the seed SQL script.');
        setMovements([]);
        return [];
      }
      showError('Error al cargar historial de movimientos: ' + err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [setLoading, showError]);

  return {
    movements,
    loading,
    getMovements
  };
}

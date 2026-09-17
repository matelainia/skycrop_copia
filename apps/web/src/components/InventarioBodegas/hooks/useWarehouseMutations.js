import { useCallback } from 'react';
import * as warehouseService from '../services/warehouseService';
import { useInventoryModule } from '../context/InventoryModuleContext';
import { validateWarehouse } from '../schemas/warehouse.schema';

export function useWarehouseMutations(onSuccess) {
  const { withFeedback, showError } = useInventoryModule();

  const createWarehouse = useCallback(async (warehouseForm) => {
    const validation = validateWarehouse(warehouseForm);
    if (!validation.success) {
      const errorMsg = Object.values(validation.errors).join(' ');
      showError(errorMsg);
      return null;
    }

    try {
      const newWh = await withFeedback(
        () => warehouseService.createWarehouse(warehouseForm),
        'Bodega registrada correctamente.'
      );
      if (onSuccess) onSuccess();
      return newWh;
    } catch (err) {
      return null;
    }
  }, [withFeedback, showError, onSuccess]);

  // La confirmación la pide ConfirmDialog en la UI; aquí solo se ejecuta.
  const deleteWarehouse = useCallback(async (id) => {
    try {
      await withFeedback(
        () => warehouseService.deleteWarehouse(id),
        'Bodega eliminada correctamente.'
      );
      if (onSuccess) onSuccess();
      return true;
    } catch (err) {
      return false;
    }
  }, [withFeedback, onSuccess]);

  return {
    createWarehouse,
    deleteWarehouse
  };
}

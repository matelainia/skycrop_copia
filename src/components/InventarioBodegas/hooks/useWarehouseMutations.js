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

  const deleteWarehouse = useCallback(async (id) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta bodega? Los artículos asociados no se borrarán, pero quedarán sin bodega asignada.')) return false;

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

import { useCallback } from 'react';
import * as inventoryService from '../services/inventoryService';
import * as inventoryMovementService from '../services/inventoryMovementService';
import { useInventoryModule } from '../context/InventoryModuleContext';
import { validateInventoryItem } from '../schemas/inventory.schema';
import { validateInventoryMovement } from '../schemas/movement.schema';

export function useInventoryMutations(onSuccess) {
  const { withFeedback, showError } = useInventoryModule();

  const createItem = useCallback(async (itemForm) => {
    const validation = validateInventoryItem(itemForm);
    if (!validation.success) {
      const errorMsg = Object.values(validation.errors).join(' ');
      showError(errorMsg);
      return null;
    }

    try {
      const newItem = await withFeedback(
        () => inventoryService.createItem(itemForm),
        'Insumo registrado correctamente en el inventario.'
      );
      if (onSuccess) onSuccess();
      return newItem;
    } catch (err) {
      // Error is already handled by withFeedback
      return null;
    }
  }, [withFeedback, showError, onSuccess]);

  const deleteItem = useCallback(async (id) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este artículo del inventario?')) return false;

    try {
      await withFeedback(
        () => inventoryService.deleteItem(id),
        'Artículo eliminado del inventario.'
      );
      if (onSuccess) onSuccess();
      return true;
    } catch (err) {
      return false;
    }
  }, [withFeedback, onSuccess]);

  const adjustStock = useCallback(async (itemId, quantity, type, reason, warehouseId) => {
    const validation = validateInventoryMovement({ cantidad: quantity, tipo: type });
    if (!validation.success) {
      const errorMsg = Object.values(validation.errors).join(' ');
      showError(errorMsg);
      return null;
    }

    try {
      const result = await withFeedback(
        () => inventoryMovementService.adjustStock(itemId, quantity, type, reason, warehouseId),
        'Ajuste de inventario realizado con éxito.'
      );
      if (onSuccess) onSuccess();
      return result;
    } catch (err) {
      return null;
    }
  }, [withFeedback, showError, onSuccess]);

  return {
    createItem,
    deleteItem,
    adjustStock
  };
}

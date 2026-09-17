import { useCallback } from 'react';
import * as inventoryService from '../services/inventoryService';
import * as inventoryMovementService from '../services/inventoryMovementService';
import { useInventoryModule } from '../context/InventoryModuleContext';
import { validateInventoryItem } from '../schemas/inventory.schema';
import { validateInventoryMovement } from '../schemas/movement.schema';

export function useInventoryMutations(onSuccess) {
  const { withFeedback, showError } = useInventoryModule();

  // Mapea el contrato de errores del backend ([VALIDATION] [PERMISSION]
  // [NOT_FOUND] [CONFLICT]) a mensajes accionables. PERMISSION y CONFLICT
  // son estados diferenciados, no errores genéricos (contrato-v2 §6).
  const mapRpcError = useCallback((err) => {
    const raw = err?.message || 'Ha ocurrido un error inesperado.';
    if (raw.includes('[CONFLICT]')) {
      return '⚠️ Conflicto de stock: ' + raw.replace('[CONFLICT]', '').trim() + ' Recarga y reintenta.';
    }
    if (raw.includes('[PERMISSION]')) {
      return '⛔ Sin permiso: ' + raw.replace('[PERMISSION]', '').trim();
    }
    if (raw.includes('[VALIDATION]')) {
      return raw.replace('[VALIDATION]', '').trim();
    }
    if (raw.includes('[NOT_FOUND]')) {
      return raw.replace('[NOT_FOUND]', '').trim();
    }
    return raw;
  }, []);

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

  // La confirmación la pide ConfirmDialog en la UI; aquí solo se ejecuta.
  const deleteItem = useCallback(async (id) => {
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
        type === 'salida' ? 'Salida registrada.' : type === 'ajuste' ? 'Conteo físico aplicado.' : 'Entrada registrada.'
      );
      if (onSuccess) onSuccess();
      return result;
    } catch (err) {
      showError(mapRpcError(err));
      return null;
    }
  }, [withFeedback, showError, onSuccess, mapRpcError]);

  const transferStock = useCallback(async (itemId, quantity, destWarehouseId, reason) => {
    const validation = validateInventoryMovement({ cantidad: quantity, tipo: 'transferencia', destWarehouseId });
    if (!validation.success) {
      const errorMsg = Object.values(validation.errors).join(' ');
      showError(errorMsg);
      return null;
    }

    try {
      const result = await withFeedback(
        () => inventoryMovementService.transferStock(itemId, quantity, destWarehouseId, reason),
        'Transferencia registrada.'
      );
      if (onSuccess) onSuccess();
      return result;
    } catch (err) {
      showError(mapRpcError(err));
      return null;
    }
  }, [withFeedback, showError, onSuccess, mapRpcError]);

  const updateItem = useCallback(async (id, itemForm) => {
    const validation = validateInventoryItem(itemForm);
    if (!validation.success) {
      const errorMsg = Object.values(validation.errors).join(' ');
      showError(errorMsg);
      return null;
    }

    try {
      const updated = await withFeedback(
        () => inventoryService.updateItem(id, itemForm),
        'Artículo actualizado.'
      );
      if (onSuccess) onSuccess();
      return updated;
    } catch (err) {
      return null;
    }
  }, [withFeedback, showError, onSuccess]);

  return {
    createItem,
    updateItem,
    deleteItem,
    adjustStock,
    transferStock
  };
}

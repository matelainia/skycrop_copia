import { useMemo } from 'react';
import { useAuthContext } from '../../../context/AuthContext';

// Permisos granulares del módulo (contrato-v2 §D6, migración 060).
// El backend bloquea igualmente; esto solo gobierna la UI + estado "denied"
// diferenciado. Sin AuthProvider (tests), todo permitido salvo lectura.
export function useInventoryPermissions() {
  let ctx = null;
  try {
    ctx = useAuthContext();
  } catch {
    ctx = null;
  }
  const hasPermission = ctx?.hasPermission;

  return useMemo(() => {
    const can = (recurso, accion) => {
      if (typeof hasPermission !== 'function') return recurso === 'inventario' || recurso === 'bodegas';
      return hasPermission(recurso, accion);
    };
    const canView = can('inventario', 'leer');
    const canCreate = can('inventario', 'crear');
    const canEdit = can('inventario', 'editar');
    const canDelete = can('inventario', 'eliminar');
    return {
      canView,
      canCreate,
      canEdit,
      canDelete,
      canMove: canCreate, // inventory.movements → (inventario, crear) según 060
      canManageWarehouses: can('bodegas', 'todo'),
      canViewWarehouses: can('bodegas', 'leer'),
    };
  }, [hasPermission]);
}

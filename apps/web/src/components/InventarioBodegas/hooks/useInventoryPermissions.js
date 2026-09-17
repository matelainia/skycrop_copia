import { useAuthContext } from '../../../context/AuthContext';

// Permisos granulares del módulo (contrato-v2 §D6, migración 060).
// El backend bloquea igualmente; esto solo gobierna la UI + estado "denied"
// diferenciado.
export function useInventoryPermissions() {
  const { hasPermission } = useAuthContext();

  const can = (recurso, accion) => {
    if (typeof hasPermission !== 'function') return true;
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
}

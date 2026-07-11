import React from 'react';
import InventoryRow from './InventoryRow';

export default function InventoryTable({
  items = [],
  warehouses = [],
  onViewItem,
  onAdjustStock,
  onDeleteItem
}) {
  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th>Artículo</th>
            <th>Categoría</th>
            <th>Stock Actual</th>
            <th>Bodega Asignada</th>
            <th>Mínimo Requerido</th>
            <th>Estado</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map(item => (
              <InventoryRow
                key={item.id}
                item={item}
                warehouse={warehouses.find(w => w.id === item.warehouseId)}
                onView={onViewItem}
                onAdjust={onAdjustStock}
                onDelete={onDeleteItem}
              />
            ))
          ) : (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                No se encontraron artículos con los filtros actuales.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

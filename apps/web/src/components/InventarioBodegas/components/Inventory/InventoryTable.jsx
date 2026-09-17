import React from 'react';
import InventoryRow from './InventoryRow';

const SORTABLE = [
  { key: 'name', label: 'Artículo' },
  { key: 'category', label: 'Categoría' },
  { key: 'stock', label: 'Stock Actual' },
];

export default function InventoryTable({
  items = [],
  warehouses = [],
  getStatus,
  permissions = {},
  sortKey = 'name',
  sortDir = 1,
  onSort,
  onViewItem,
  onMoveItem,
  onEditItem,
  onDeleteItem
}) {
  const arrow = (key) => {
    if (sortKey !== key) return <span style={{ opacity: 0.35, marginLeft: '4px' }}>⇅</span>;
    return <span style={{ marginLeft: '4px' }}>{sortDir === 1 ? '▲' : '▼'}</span>;
  };

  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            {SORTABLE.map((c) => (
              <th
                key={c.key}
                onClick={() => onSort && onSort(c.key)}
                title={`Ordenar por ${c.label}`}
                style={{ cursor: onSort ? 'pointer' : 'default', userSelect: 'none' }}
                aria-sort={sortKey === c.key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
              >
                {c.label}{arrow(c.key)}
              </th>
            ))}
            <th>Bodega Asignada</th>
            <th>Mínimo Requerido</th>
            <th>Estado</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((item) => (
              <InventoryRow
                key={item.id}
                item={item}
                warehouse={warehouses.find((w) => w.id === item.warehouseId)}
                status={getStatus ? getStatus(item) : 'opt'}
                permissions={permissions}
                onView={onViewItem}
                onMove={onMoveItem}
                onEdit={onEditItem}
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

import React from 'react';
import { Eye, Edit3, Trash2 } from 'lucide-react';
import ItemIcon from '../Shared/ItemIcon';
import ItemStatusBadge from '../Shared/ItemStatusBadge';

export default function InventoryRow({
  item,
  warehouse,
  onView,
  onAdjust,
  onDelete
}) {
  const isLow = item.quantity < item.minQuantity;

  return (
    <tr>
      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ItemIcon category={item.category} name={item.name} />
          <div>
            <div>{item.name}</div>
            {(item.lote || item.registroIca) && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                {item.lote && `Lote: ${item.lote}`} {item.lote && item.registroIca && ' | '} {item.registroIca && `ICA: ${item.registroIca}`}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>{item.category}</td>
      <td style={{ fontWeight: '600' }}>
        {item.quantity} {item.unit}
      </td>
      <td>{warehouse ? warehouse.nombre : 'Sin asignar'}</td>
      <td style={{ color: 'var(--text-secondary)' }}>Min: {item.minQuantity}</td>
      <td>
        <ItemStatusBadge isLow={isLow} />
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onView(item)}
            style={{ padding: '6px 8px', fontSize: '12px' }}
            title="Ver Detalles"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onAdjust(item)}
            style={{ padding: '6px 8px', fontSize: '12px' }}
            title="Ajustar Inventario"
          >
            <Edit3 size={14} />
          </button>
          <button
            className="btn btn-danger"
            onClick={() => onDelete(item.id)}
            style={{ padding: '6px 8px', fontSize: '12px' }}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

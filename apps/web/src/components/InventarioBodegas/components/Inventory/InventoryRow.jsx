import React from 'react';
import { Eye, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react';
import ItemIcon from '../Shared/ItemIcon';
import ItemStatusBadge from '../Shared/ItemStatusBadge';

export default function InventoryRow({
  item,
  warehouse,
  status = 'opt',
  permissions = {},
  onView,
  onMove,
  onEdit,
  onDelete
}) {
  const { canMove = true, canEdit = true, canDelete = true } = permissions;

  return (
    <tr>
      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ItemIcon category={item.category} name={item.name} />
          <div>
            <div>{item.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
              {item.sku || 'sin SKU'}
              {(item.lote || item.registroIca) && (
                <> · {item.lote && `Lote: ${item.lote}`} {item.lote && item.registroIca && '| '} {item.registroIca && `ICA: ${item.registroIca}`}</>
              )}
            </div>
          </div>
        </div>
      </td>
      <td>{item.category}</td>
      <td style={{ fontWeight: '600' }}>
        {item.quantity} {item.unit}
      </td>
      <td>{warehouse ? warehouse.nombre : 'Sin asignar'}</td>
      <td style={{ color: 'var(--text-secondary)' }}>
        Min: {item.minQuantity}{item.maxQuantity !== null && item.maxQuantity !== undefined && item.maxQuantity !== '' ? ` · Máx: ${item.maxQuantity}` : ''}
      </td>
      <td>
        <ItemStatusBadge status={status} />
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
            onClick={() => canMove && onMove(item)}
            disabled={!canMove}
            style={{ padding: '6px 8px', fontSize: '12px' }}
            title={canMove ? 'Registrar movimiento' : 'Sin permiso para movimientos'}
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => canEdit && onEdit(item)}
            disabled={!canEdit}
            style={{ padding: '6px 8px', fontSize: '12px' }}
            title={canEdit ? 'Editar artículo' : 'Sin permiso para editar'}
          >
            <Pencil size={14} />
          </button>
          <button
            className="btn btn-danger"
            onClick={() => canDelete && onDelete(item.id)}
            disabled={!canDelete}
            style={{ padding: '6px 8px', fontSize: '12px' }}
            title={canDelete ? 'Eliminar' : 'Sin permiso para eliminar'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

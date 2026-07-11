import React from 'react';
import { X } from 'lucide-react';
import ItemIcon from '../Shared/ItemIcon';
import ItemStatusBadge from '../Shared/ItemStatusBadge';
import InventoryMovementsHistory from '../../components/Movements/InventoryMovementsHistory';

export default function ViewItemModal({
  isOpen,
  onClose,
  item,
  warehouseName = "Sin asignar",
  movements = [],
  movementsLoading = false
}) {
  if (!isOpen || !item) return null;

  const isLow = item.quantity < item.minQuantity;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" style={{ width: '550px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Detalles del Insumo</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ItemIcon category={item.category} name={item.name} style={{ fontSize: '32px' }} />
            <div>
              <h4 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '700' }}>{item.name}</h4>
              <span style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {item.category}
              </span>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Stock Actual:</span>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                {item.quantity} {item.unit}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Mínimo Requerido:</span>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                Min: {item.minQuantity} {item.unit}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Lote:</span>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>
                {item.lote || 'Sin especificar'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Registro ICA:</span>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>
                {item.registroIca || 'Sin especificar'}
              </div>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Bodega Asignada:</span>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>
              {warehouseName}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Estado del Inventario:</span>
            <div style={{ marginTop: '6px' }}>
              <ItemStatusBadge isLow={isLow} type="badge" />
            </div>
          </div>

          {item.comentarios && (
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Comentarios:</span>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                {item.comentarios}
              </div>
            </div>
          )}

          {/* Audit trail / movement logs list */}
          <InventoryMovementsHistory movements={movements} loading={movementsLoading} />

          <div style={{ marginTop: '10px' }}>
            <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
              Cerrar Detalles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


import React from 'react';
import { Plus } from 'lucide-react';
import { getResponsableName } from '../../utils/inventoryHelpers';

// Tab Bodegas: tarjetas completas con ocupación real + acciones.
export default function WarehousesTab({
  warehouses = [],
  workers = [],
  items = [],
  canManage = true,
  onViewItems,
  onManage
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {warehouses.map((w) => {
          const count = items.filter((it) => it.warehouseId === w.id).length;
          const pct = Number(w.capacidad) > 0
            ? Math.min(100, Math.round((Number(w.ocupacion) || 0) / Number(w.capacidad) * 100))
            : null;
          return (
            <div key={w.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{w.nombre}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {w.sector} · {w.categoria}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Responsable: <strong>{getResponsableName(w.responsableId, workers)}</strong>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Ocupación</span>
                  <span>{pct === null ? `${count} artículos` : `${pct}% · ${w.ocupacion}/${w.capacidad}`}</span>
                </div>
                {pct !== null && (
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ flexGrow: 1, justifyContent: 'center' }} onClick={() => onViewItems(w.id)}>
                  Ver insumos
                </button>
                {canManage && (
                  <button className="btn btn-secondary" style={{ flexGrow: 1, justifyContent: 'center' }} onClick={onManage}>
                    Editar
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {canManage && (
          <button
            onClick={onManage}
            style={{
              border: '1.5px dashed var(--border-color)', borderRadius: '12px', background: 'none',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '700',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '8px', minHeight: '180px'
            }}
          >
            <span style={{ width: '44px', height: '44px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} />
            </span>
            Nueva bodega
          </button>
        )}
      </div>
      {warehouses.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '12px' }}>
          No hay bodegas registradas.
        </p>
      )}
    </div>
  );
}

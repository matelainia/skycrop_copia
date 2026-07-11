import React from 'react';
import { getResponsableName } from '../../utils/inventoryHelpers';

export default function WarehouseCards({
  warehouseStats = [],
  activeWarehouse,
  onSelectWarehouse,
  workers = []
}) {
  return (
    <div className="warehouse-grid">
      {warehouseStats.map(wh => (
        <div
          key={wh.id}
          className={`warehouse-cell ${activeWarehouse === wh.id ? 'active' : ''}`}
          onClick={() => onSelectWarehouse(wh.id)}
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}
        >
          <div>
            <div className="warehouse-cell-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{wh.name}</span>
              {wh.id !== 'all' && (
                <span style={{ fontSize: '10px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {wh.categoria}
                </span>
              )}
            </div>
            <div className="warehouse-cell-details">{wh.location}</div>

            {wh.id !== 'all' && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {wh.coordenadaX !== null && wh.coordenadaY !== null && wh.coordenadaX !== undefined && wh.coordenadaY !== undefined && (
                  <div>Ubicación: ({wh.coordenadaX}, {wh.coordenadaY})</div>
                )}
                <div>Responsable: {getResponsableName(wh.responsableId, workers)}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)' }}>
            {wh.count} {wh.count === 1 ? 'artículo' : 'artículos'}
          </div>
        </div>
      ))}
    </div>
  );
}

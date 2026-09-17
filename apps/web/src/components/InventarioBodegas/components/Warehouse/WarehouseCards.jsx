import React from 'react';
import { getResponsableName } from '../../utils/inventoryHelpers';

// Strip de bodegas: clic filtra la tabla (y viceversa). Muestra ocupación
// real (trigger 061) y conteo de alertas por bodega.
export default function WarehouseCards({
  warehouseStats = [],
  activeWarehouse,
  onSelectWarehouse,
  workers = []
}) {
  return (
    <div className="warehouse-grid">
      {warehouseStats.map((wh) => (
        <div
          key={wh.id}
          role="button"
          tabIndex={0}
          aria-pressed={activeWarehouse === wh.id}
          className={`warehouse-cell ${activeWarehouse === wh.id ? 'active' : ''}`}
          onClick={() => onSelectWarehouse(wh.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectWarehouse(wh.id);
            }
          }}
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
                {wh.occupancyPct !== null && wh.occupancyPct !== undefined && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>Ocupación</span>
                      <span>{wh.occupancyPct}%</span>
                    </div>
                    <div className="progress-bar-container" style={{ marginTop: '4px' }}>
                      <div className="progress-bar-fill" style={{ width: `${wh.occupancyPct}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>{wh.count} {wh.count === 1 ? 'artículo' : 'artículos'}</span>
            {wh.alerts > 0 && (
              <span className="badge badge-red">{wh.alerts} {wh.alerts === 1 ? 'alerta' : 'alertas'}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

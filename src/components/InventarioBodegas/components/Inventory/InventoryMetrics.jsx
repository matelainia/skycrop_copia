import React from 'react';
import { Package, AlertTriangle, Layers } from 'lucide-react';

export default function InventoryMetrics({
  totalItemsCount = 0,
  lowStockCount = 0,
  warehousesCount = 0,
  occupancyPercentage = 0
}) {
  return (
    <div className="metrics-grid">
      <div className="glass-card primary-edge">
        <div className="card-title-section">
          <span className="card-label">Total Insumos</span>
          <div className="card-icon-box green">
            <Package size={18} />
          </div>
        </div>
        <div className="card-value">{totalItemsCount}</div>
        <div className="card-desc">Artículos registrados en catálogo</div>
      </div>

      <div className="glass-card danger-edge">
        <div className="card-title-section">
          <span className="card-label">Bajo Stock Crítico</span>
          <div className="card-icon-box red">
            <AlertTriangle size={18} />
          </div>
        </div>
        <div className="card-value">{lowStockCount}</div>
        <div className="card-desc">Requieren reabastecimiento urgente</div>
      </div>

      <div className="glass-card info-edge">
        <div className="card-title-section">
          <span className="card-label">Bodegas Monitoreadas</span>
          <div className="card-icon-box blue">
            <Layers size={18} />
          </div>
        </div>
        <div className="card-value">{warehousesCount}</div>
        <div className="card-desc">Espacios físicos diferenciados</div>
      </div>

      <div className="glass-card primary-edge">
        <div className="card-title-section">
          <span className="card-label">Ocupación Bodega Central</span>
          <div className="card-icon-box green">
            <Layers size={18} />
          </div>
        </div>
        <div className="card-value">{occupancyPercentage}%</div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${occupancyPercentage}%` }}></div>
        </div>
      </div>
    </div>
  );
}

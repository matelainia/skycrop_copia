import React from 'react';
import { useMonitoringContext } from '../../context/MonitoringContext';

export default function CostsView() {
  const { costos } = useMonitoringContext();

  const totalCost = costos.reduce((acc, curr) => acc + curr.costo, 0);

  return (
    <div className="sanitary-layout-grid">
      <div className="glass-card">
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Consolidado Financiero Fitosanitario</h3>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="glass-card" style={{ flexGrow: 1, padding: '16px' }}>
            <span className="card-label">Costo Total Campaña</span>
            <div className="card-value">${totalCost.toLocaleString()} COP</div>
          </div>
          <div className="glass-card" style={{ flexGrow: 1, padding: '16px' }}>
            <span className="card-label">Costo por ha Promedio</span>
            <div className="card-value">$86,400 COP</div>
          </div>
        </div>
      </div>
    </div>
  );
}

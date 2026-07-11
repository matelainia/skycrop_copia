
import { Tractor, Activity, Clock, Droplet, ShieldCheck } from 'lucide-react';

export const FleetMetrics = ({ metrics }) => {
  return (
    <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <div className="glass-card primary-edge" style={{ padding: '16px 20px' }}>
        <div className="card-title-section">
          <span className="card-label" style={{ fontSize: '11px' }}>MAQUINARIA TOTAL</span>
          <div className="card-icon-box green" style={{ width: '30px', height: '30px' }}><Tractor size={16} /></div>
        </div>
        <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{metrics.totalCount}</div>
        <div className="card-desc" style={{ fontSize: '11px' }}>Equipos registrados</div>
      </div>

      <div className="glass-card info-edge" style={{ padding: '16px 20px' }}>
        <div className="card-title-section">
          <span className="card-label" style={{ fontSize: '11px' }}>OPERANDO AHORA</span>
          <div className="card-icon-box blue" style={{ width: '30px', height: '30px' }}><Activity size={16} /></div>
        </div>
        <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{metrics.operatingCount}</div>
        <div className="card-desc" style={{ fontSize: '11px' }}>Equipos en operación</div>
      </div>

      <div className="glass-card warning-edge" style={{ padding: '16px 20px' }}>
        <div className="card-title-section">
          <span className="card-label" style={{ fontSize: '11px' }}>HORAS TRABAJADAS HOY</span>
          <div className="card-icon-box yellow" style={{ width: '30px', height: '30px' }}><Clock size={16} /></div>
        </div>
        <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{metrics.totalHoursWorkedToday.toFixed(1)} h</div>
        <div className="card-desc" style={{ fontSize: '11px' }}>Total de la flota</div>
      </div>

      <div className="glass-card info-edge" style={{ padding: '16px 20px' }}>
        <div className="card-title-section">
          <span className="card-label" style={{ fontSize: '11px' }}>CONSUMO HOY</span>
          <div className="card-icon-box red" style={{ width: '30px', height: '30px' }}><Droplet size={16} /></div>
        </div>
        <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{Math.round(metrics.totalFuelConsumedToday)} L</div>
        <div className="card-desc" style={{ fontSize: '11px' }}>Combustible total</div>
      </div>

      <div className="glass-card primary-edge" style={{ padding: '16px 20px' }}>
        <div className="card-title-section">
          <span className="card-label" style={{ fontSize: '11px' }}>EFICIENCIA OPERATIVA</span>
          <div className="card-icon-box green" style={{ width: '30px', height: '30px' }}><ShieldCheck size={16} /></div>
        </div>
        <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>92%</div>
        <div className="card-desc" style={{ fontSize: '11px' }}>vs. meta diaria</div>
      </div>
    </div>
  );
};

export default FleetMetrics;

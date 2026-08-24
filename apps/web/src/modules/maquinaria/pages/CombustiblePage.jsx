import { useMemo } from 'react';
import FuelTable from '../components/tables/FuelTable';

export const CombustiblePage = ({
  machineryHook
}) => {
  const { machinery, metrics } = machineryHook;

  const avgFleetConsumption = useMemo(() => {
    const rates = (machinery || [])
      .filter(m => m.status === 'Operando')
      .map(m => parseFloat(m.fuelConsumption))
      .filter(v => !isNaN(v) && v > 0);
    if (rates.length === 0) return null;
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  }, [machinery]);

  const topConsumer = useMemo(() => {
    let best = null;
    (machinery || []).forEach(m => {
      const rate = parseFloat(m.fuelConsumption) || 0;
      const consumed = m.status === 'Operando' ? rate * (m.hoursToday || 0) : 0;
      if (!best || consumed > best.consumed) best = { code: m.codigoId, type: m.type, rate, consumed };
    });
    return best && best.consumed > 0 ? best : null;
  }, [machinery]);

  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Monitoreo de Consumo y Carga de Combustible</h3>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Consumo acumulado hoy: <strong style={{ color: 'var(--primary)' }}>{Math.round(metrics.totalFuelConsumedToday)} Litros</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-card info-edge" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PRECIO DE DIESEL</span>
          <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0', color: 'var(--text-muted)' }}>—</div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sin datos disponibles</span>
        </div>

        <div className="glass-card primary-edge" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CONSUMO PROMEDIO FLOTA</span>
          <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>
            {avgFleetConsumption != null ? `${avgFleetConsumption.toFixed(1)} L / hora` : '—'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Durante labores activas</span>
        </div>

        <div className="glass-card warning-edge" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MAYOR CONSUMIDOR HOY</span>
          <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>{topConsumer ? topConsumer.code : '—'}</div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {topConsumer ? `${topConsumer.rate.toFixed(1)} L/h - ${topConsumer.type || ''}` : 'Sin consumo registrado hoy'}
          </span>
        </div>
      </div>

      <FuelTable machinery={machinery} />
    </div>
  );
};

export default CombustiblePage;

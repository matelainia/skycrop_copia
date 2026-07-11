import FuelTable from '../components/tables/FuelTable';

export const CombustiblePage = ({
  machineryHook
}) => {
  const { machinery, metrics } = machineryHook;

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
          <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>$4,100 / Litro</div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Costo base estimado ERP</span>
        </div>

        <div className="glass-card primary-edge" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CONSUMO PROMEDIO FLOTA</span>
          <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>16.8 L / hora</div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Durante labores activas</span>
        </div>

        <div className="glass-card warning-edge" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MAYOR CONSUMIDOR HOY</span>
          <div style={{ fontSize: '20px', fontWeight: '700', margin: '4px 0' }}>CO-002</div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>28.0 L/h - Cosechadora</span>
        </div>
      </div>

      <FuelTable machinery={machinery} />
    </div>
  );
};

export default CombustiblePage;

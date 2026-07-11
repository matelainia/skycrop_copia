

export const FleetEfficiencyChart = () => {
  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>EFICIENCIA DE LA FLOTA</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <span>Meta Diaria</span>
            <strong style={{ color: 'var(--primary)' }}>92%</strong>
          </div>
          <div className="progress-bar-container" style={{ height: '6px' }}>
            <div className="progress-bar-fill" style={{ width: '92%' }}></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          <div>Disponibilidad: <strong>88%</strong></div>
          <div>Utilización: <strong>94%</strong></div>
        </div>
      </div>
    </div>
  );
};

export default FleetEfficiencyChart;

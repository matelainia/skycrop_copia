

export const DistributionChart = () => {
  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>DISTRIBUCIÓN DE HORAS POR TIPO</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px' }}>
          {/* Donut Chart representation with strokes */}
          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#16a34a" strokeWidth="15" strokeDasharray="251" strokeDashoffset="120" />
          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ea580c" strokeWidth="15" strokeDasharray="251" strokeDashoffset="210" transform="rotate(187 50 50)" />
          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2563eb" strokeWidth="15" strokeDasharray="251" strokeDashoffset="230" transform="rotate(245 50 50)" />
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
            <span>Tractores (52%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c' }} />
            <span>Cosechadoras (20%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }} />
            <span>Otros (28%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributionChart;


import { Droplet } from 'lucide-react';

export const FuelChart = () => {
  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700' }}>CONSUMO COMBUSTIBLE (7 DÍAS)</h3>
        <span style={{ fontSize: '14px', fontWeight: '700' }}><Droplet size={14} style={{ display: 'inline', marginRight: '4px' }} />1,892 L</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', margin: '10px 0' }}>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Promedio diario</span>
          <p style={{ fontWeight: '600' }}>270 L</p>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Costo estimado</span>
          <p style={{ fontWeight: '600' }}>$9,460,000 COP</p>
        </div>
      </div>

      {/* Minimal bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '40px', marginTop: '10px' }}>
        {[30, 45, 38, 55, 48, 62, 50].map((h, i) => (
          <div key={i} style={{ flexGrow: 1, background: 'rgba(239, 68, 68, 0.1)', height: `${h}%`, borderRadius: '3px 3px 0 0', position: 'relative' }}>
            <div style={{ background: '#ea580c', height: '100%', width: '100%', borderRadius: '3px 3px 0 0' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FuelChart;

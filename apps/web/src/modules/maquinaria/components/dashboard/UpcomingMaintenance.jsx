
import { AlertTriangle } from 'lucide-react';

export const UpcomingMaintenance = ({ alerts, onViewAll }) => {
  const combined = useUpcomingList(alerts);

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Próximos Mantenimientos</h3>
        <button 
          className="btn" 
          style={{ padding: '2px 6px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--primary)' }} 
          onClick={onViewAll}
        >
          Ver todos
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {combined.slice(0, 3).map(({ machine, hoursLeft, isCritical }) => (
          <div key={machine.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertTriangle size={14} style={{ color: isCritical ? 'var(--accent-red)' : 'var(--accent-gold)' }} />
              <div>
                <div style={{ fontWeight: '600' }}>{machine.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{machine.codigoId}</div>
              </div>
            </div>
            <span className={`badge ${isCritical ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
              En {hoursLeft} h
            </span>
          </div>
        ))}
        {combined.length === 0 && (
          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>
            Sin alertas de mantenimiento preventivo.
          </span>
        )}
      </div>
    </div>
  );
};

// Internal custom helper hook/function to merge critical and warning list
function useUpcomingList(alerts) {
  const list = [];
  if (alerts?.critical) {
    alerts.critical.forEach(c => list.push({ machine: c.machine, hoursLeft: c.hoursLeft, isCritical: true }));
  }
  if (alerts?.warning) {
    alerts.warning.forEach(w => list.push({ machine: w.machine, hoursLeft: w.hoursLeft, isCritical: false }));
  }
  return list.sort((a, b) => a.hoursLeft - b.hoursLeft);
}

export default UpcomingMaintenance;


import { formatDateTime } from '../../utils/formatters';

export const RecentActivity = ({ jornadas, onViewAll }) => {
  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Actividad Reciente</h3>
        <button 
          className="btn" 
          style={{ padding: '2px 6px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--primary)' }} 
          onClick={onViewAll}
        >
          Ver todo
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
        {jornadas.slice(0, 4).map(j => (
          <div key={j.id} style={{ display: 'flex', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: j.status === 'En Progreso' ? 'var(--primary)' : 'var(--text-muted)'
              }} />
              <div style={{ width: '1px', flexGrow: 1, background: 'var(--border-color)', marginTop: '4px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: '600' }}>{j.maquinariaCodigo}</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {j.status === 'En Progreso' ? `Inició labor en ${j.lot}` : `Finalizó labor en ${j.lot}`}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {formatDateTime(j.startTime)}
              </span>
            </div>
          </div>
        ))}
        {jornadas.length === 0 && (
          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>
            Sin actividad registrada.
          </span>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;

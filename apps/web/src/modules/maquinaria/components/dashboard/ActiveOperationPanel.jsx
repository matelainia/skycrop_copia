
import MachineAvatar from '../machinery/MachineAvatar';
import { formatDateTime } from '../../utils/formatters';

export const ActiveOperationPanel = ({
  activeMachine,
  activeJornada,
  onStartLabor,
  onEndLabor
}) => {
  return (
    <div className="glass-card primary-edge" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>OPERACIÓN ACTUAL</h3>
        <span className={`badge ${activeJornada ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '10px', textTransform: 'none', padding: '2px 8px' }}>
          {activeJornada ? '● En progreso' : '● Inactivo'}
        </span>
      </div>

      {activeMachine ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeMachine.photoUrl ? (
            <img
              src={activeMachine.photoUrl}
              alt={activeMachine.name}
              style={{ width: '100%', height: '140px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
            />
          ) : (
            <div style={{ width: '100%', height: '140px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
              <MachineAvatar name={activeMachine.name} type={activeMachine.type} size={60} />
            </div>
          )}

          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '800' }}>{activeMachine.name}</h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {activeMachine.codigoId}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Operador:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{activeMachine.operatorName || '--'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Labor:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{activeMachine.currentTask || '--'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Lote:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{activeJornada?.lot || activeMachine.currentLot || '--'}</strong>
            </div>

            {activeJornada && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Inicio:</span>
                  <span style={{ fontWeight: '500' }}>{formatDateTime(activeJornada.startTime)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Horómetro inicial:</span>
                  <span style={{ fontWeight: '500' }}>{activeJornada.startHorometro.toLocaleString()} h</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Horas trabajadas:</span>
                  <strong style={{ color: 'var(--primary)' }}>{activeMachine.hoursToday.toFixed(1)} h</strong>
                </div>
              </>
            )}
          </div>

          {activeJornada ? (
            <button
              className="btn btn-danger"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              onClick={() => onEndLabor(activeJornada.id)}
            >
              Finalizar Labor
            </button>
          ) : activeMachine.status === 'Disponible' ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              onClick={() => onStartLabor(activeMachine.id)}
            >
              Iniciar Labor
            </button>
          ) : (
            <div style={{ padding: '10px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Equipo en mantenimiento o inhabilitado.
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Selecciona un equipo de la lista para ver su estado operacional.
        </div>
      )}
    </div>
  );
};

export default ActiveOperationPanel;

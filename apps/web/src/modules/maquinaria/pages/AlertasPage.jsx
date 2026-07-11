import { AlertOctagon, AlertTriangle } from 'lucide-react';

export const AlertasPage = ({
  machineryHook,
  maintenanceHook
}) => {
  const { alerts, openMaintenanceForm } = maintenanceHook;
  const { machinery, setSelectedMachine, setIsEditMachineOpen } = machineryHook;

  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Panel de Alertas y Notificaciones de Flota</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Critical service warnings */}
        {alerts.critical.map(({ machine, hoursLeft }) => (
          <div key={machine.id} style={{ display: 'flex', gap: '14px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '16px', alignItems: 'center' }}>
            <AlertOctagon size={24} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
            <div style={{ flexGrow: 1, fontSize: '13px' }}>
              <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Mantenimiento Crítico Requerido: {machine.codigoId}</h4>
              <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                El equipo <strong>{machine.name}</strong> ha trabajado {machine.hoursOfOperation.toLocaleString()} horas y se encuentra a {hoursLeft} horas del límite programado.
              </p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'rgba(239, 68, 68, 0.25)' }}
              onClick={() => openMaintenanceForm(machine.id)}
            >
              Registrar Servicio
            </button>
          </div>
        ))}

        {/* Out of service machines */}
        {alerts.outOfService.map(({ machine, reason }) => (
          <div key={machine.id} style={{ display: 'flex', gap: '14px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '16px', alignItems: 'center' }}>
            <AlertTriangle size={24} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
            <div style={{ flexGrow: 1, fontSize: '13px' }}>
              <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Equipo fuera de servicio: {machine.codigoId}</h4>
              <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                <strong>{machine.name}</strong> requiere inspección mecánica o repuestos técnicos urgentes. {reason}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => {
                const currentSelected = machinery.find(mac => mac.id === machine.id);
                setSelectedMachine(currentSelected);
                setIsEditMachineOpen(true);
              }}
            >
              Editar Estado
            </button>
          </div>
        ))}

        {/* Preventative warning alerts */}
        {alerts.warning.map(({ machine, hoursLeft }) => (
          <div key={machine.id} style={{ display: 'flex', gap: '14px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px', padding: '16px', alignItems: 'center' }}>
            <AlertTriangle size={24} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
            <div style={{ flexGrow: 1, fontSize: '13px' }}>
              <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Mantenimiento Próximo: {machine.codigoId}</h4>
              <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                <strong>{machine.name}</strong> se acerca a su mantenimiento de rutina en {hoursLeft} horas de operación acumuladas.
              </p>
            </div>
          </div>
        ))}

        {/* Empty state check */}
        {!alerts.hasAlerts && (
          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '32px', display: 'block' }}>
            No hay alertas de mantenimiento activas en la flota. Todo marcha correctamente.
          </span>
        )}
      </div>
    </div>
  );
};

export default AlertasPage;


import { Plus } from 'lucide-react';
import MaintenanceTable from '../components/tables/MaintenanceTable';
import MaintenanceModal from '../components/dialogs/MaintenanceModal';
import MachineStatusBadge from '../components/machinery/MachineStatusBadge';
import { formatDateShort } from '../utils/formatters';

export const MantenimientosPage = ({
  machineryHook,
  maintenanceHook
}) => {
  const {
    isMaintModalOpen,
    setIsMaintModalOpen,
    maintForm,
    setMaintForm,
    handleRegisterMaintenance,
    openMaintenanceForm
  } = maintenanceHook;

  const { machinery } = machineryHook;

  return (
    <div className="glass-card">
      <div className="drawer-header" style={{ marginBottom: '20px' }}>
        <h3>Calendario y Control de Mantenimientos Preventivos</h3>
        <button
          className="btn btn-primary"
          onClick={() => openMaintenanceForm()}
        >
          <Plus size={16} />
          Programar Mantenimiento
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {machinery
          .filter(m => m.nextMaintenanceHours <= 100 || m.status === 'En mantenimiento')
          .map(m => (
            <div key={m.id} className="glass-card danger-edge" style={{ borderLeftWidth: m.nextMaintenanceHours <= 20 ? '4px' : '2px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontWeight: '700' }}>{m.codigoId} · {m.name}</h4>
                <MachineStatusBadge status={m.status} />
              </div>
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>Horómetro Actual: <strong>{m.hoursOfOperation.toLocaleString()} h</strong></div>
                <div>Horas Restantes para Servicio: <strong style={{ color: m.nextMaintenanceHours <= 20 ? 'var(--accent-red)' : 'var(--accent-gold)' }}>{m.nextMaintenanceHours} h</strong></div>
                <div>Próxima fecha estimada: <strong>{formatDateShort(m.nextMaintenance)}</strong></div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '6px', fontSize: '12px', justifyContent: 'center', marginTop: '12px' }}
                onClick={() => openMaintenanceForm(m.id)}
              >
                Registrar Servicio Realizado
              </button>
            </div>
          ))}
      </div>

      <MaintenanceTable
        machinery={machinery}
        onRegisterService={openMaintenanceForm}
      />

      <MaintenanceModal
        isOpen={isMaintModalOpen}
        onClose={() => setIsMaintModalOpen(false)}
        formData={maintForm}
        setFormData={setMaintForm}
        machineryList={machinery}
        onSubmit={handleRegisterMaintenance}
      />
    </div>
  );
};

export default MantenimientosPage;

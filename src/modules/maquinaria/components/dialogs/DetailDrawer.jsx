
import { X, Info } from 'lucide-react';
import MachineAvatar from '../machinery/MachineAvatar';
import MachineStatusBadge from '../machinery/MachineStatusBadge';
import { formatCurrency } from '../../utils/formatters';

export const DetailDrawer = ({
  isOpen,
  onClose,
  machine,
  onEdit
}) => {
  if (!isOpen || !machine) return null;

  const totalHourlyCost = machine.costOperator + machine.costFuel + machine.costMaintenance + machine.costDepreciation;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" style={{ width: '450px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Ficha Técnica del Equipo</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <MachineAvatar
              photoUrl={machine.photoUrl}
              name={machine.name}
              type={machine.type}
              size={60}
            />
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: '700' }}>{machine.name}</h4>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Categoría: {machine.type}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Código ID</span>
              <p style={{ fontWeight: '600', marginTop: '2px' }}>{machine.codigoId}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Estado Operativo</span>
              <p style={{ marginTop: '2px' }}><MachineStatusBadge status={machine.status} /></p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Horas de Operación</span>
              <p style={{ fontWeight: '600', marginTop: '2px' }}>{machine.hoursOfOperation.toLocaleString()} horas</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Consumo Promedio</span>
              <p style={{ fontWeight: '600', marginTop: '2px' }}>{machine.fuelConsumption}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Costo Promedio / hora</span>
              <p style={{ fontWeight: '600', marginTop: '2px', color: 'var(--primary)' }}>
                {formatCurrency(totalHourlyCost)} COP
              </p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Próximo Mantenimiento</span>
              <p style={{ fontWeight: '600', marginTop: '2px' }}>En {machine.nextMaintenanceHours} horas</p>
            </div>
          </div>

          <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '10px', marginTop: '8px' }}>
            <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Las calibraciones de maquinaria y sensores se programan por defecto en ciclos automáticos de 250 horas de labor continuas.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
            Cerrar Ficha
          </button>
          <button
            className="btn btn-primary"
            style={{ flexGrow: 1 }}
            onClick={() => {
              onClose();
              onEdit(machine);
            }}
          >
            Editar Información
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailDrawer;

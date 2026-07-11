
import { User, Eye, Pencil, Trash2, Play } from 'lucide-react';
import MachineAvatar from './MachineAvatar';
import MachineStatusBadge from './MachineStatusBadge';

export const MachineryRow = ({
  machine,
  isActiveRow,
  activeJornada,
  onRowClick,
  onStartLabor,
  onEndLabor,
  onViewDetails,
  onEdit,
  onDelete
}) => {
  return (
    <tr
      onClick={() => onRowClick(machine.id)}
      style={{
        cursor: 'pointer',
        background: isActiveRow ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
      }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MachineAvatar
            photoUrl={machine.photoUrl}
            name={machine.name}
            type={machine.type}
            size={40}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{machine.name}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{machine.codigoId}</span>
          </div>
        </div>
      </td>
      
      <td style={{ fontSize: '13px' }}>{machine.type}</td>
      
      <td>
        <MachineStatusBadge status={machine.status} />
      </td>
      
      <td style={{ fontSize: '13px' }}>
        {machine.operatorName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={12} style={{ color: 'var(--text-muted)' }} />
            <span>{machine.operatorName}</span>
          </div>
        ) : '--'}
      </td>
      
      <td>
        {machine.currentTask ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '500', fontSize: '13px' }}>{machine.currentTask}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{machine.currentLot}</span>
          </div>
        ) : '--'}
      </td>
      
      <td>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', fontSize: '13px' }}>
            {machine.hoursOfOperation.toLocaleString('es-ES')} h
          </span>
          <span style={{ 
            fontSize: '11px', 
            color: machine.nextMaintenanceHours <= 50 ? 'var(--accent-red)' : 'var(--text-muted)', 
            fontWeight: machine.nextMaintenanceHours <= 50 ? '600' : '400' 
          }}>
            Próx: {machine.nextMaintenanceHours} h
          </span>
        </div>
      </td>
      
      <td style={{ fontSize: '13px', fontWeight: '500' }}>
        {machine.hoursToday > 0 ? `${machine.hoursToday.toFixed(1)} h` : '0.0 h'}
      </td>
      
      <td style={{ textAlign: 'right', paddingRight: '20px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          {machine.status === 'Disponible' && (
            <button
              className="btn btn-secondary"
              style={{ padding: '6px', borderRadius: '8px' }}
              onClick={() => onStartLabor(machine.id)}
              title="Iniciar Labor"
            >
              <Play size={12} style={{ color: 'var(--primary)' }} />
            </button>
          )}

          {machine.status === 'Operando' && activeJornada && (
            <button
              className="btn btn-danger"
              style={{ padding: '6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)' }}
              onClick={() => onEndLabor(activeJornada.id)}
              title="Finalizar Labor"
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#dc2626', display: 'inline-block' }} />
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '8px' }}
            onClick={() => onViewDetails(machine)}
            title="Ver Detalles"
          >
            <Eye size={12} />
          </button>

          <button
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '8px' }}
            onClick={() => onEdit(machine)}
            title="Editar"
          >
            <Pencil size={12} />
          </button>

          <button
            className="btn btn-danger"
            style={{ padding: '6px', borderRadius: '8px' }}
            onClick={() => onDelete(machine.id)}
            title="Eliminar"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default MachineryRow;

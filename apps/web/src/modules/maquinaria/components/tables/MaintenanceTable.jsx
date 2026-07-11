
import MachineStatusBadge from '../machinery/MachineStatusBadge';
import { formatDateShort } from '../../utils/formatters';

export const MaintenanceTable = ({ machinery, onRegisterService }) => {
  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Horómetro</th>
            <th>Último Mantenimiento</th>
            <th>Próximo Mto. (Fecha)</th>
            <th>Próximo Mto. (Horas)</th>
            <th>Estado</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {machinery.map(m => (
            <tr key={m.id}>
              <td><strong>{m.codigoId}</strong> - {m.name}</td>
              <td>{m.type}</td>
              <td>{m.hoursOfOperation.toLocaleString()} h</td>
              <td>{formatDateShort(m.lastMaintenance)}</td>
              <td>{formatDateShort(m.nextMaintenance)}</td>
              <td style={{ color: m.nextMaintenanceHours <= 50 ? 'var(--accent-red)' : 'inherit', fontWeight: m.nextMaintenanceHours <= 50 ? '600' : '400' }}>
                En {m.nextMaintenanceHours} horas
              </td>
              <td><MachineStatusBadge status={m.status} /></td>
              <td style={{ textAlign: 'right' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px' }}
                  onClick={() => onRegisterService(m.id)}
                >
                  Service
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MaintenanceTable;

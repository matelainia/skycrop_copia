
import MachineIcon from '../machinery/MachineIcon';
import { formatDateTime, formatCurrency } from '../../utils/formatters';

export const OperationsTable = ({ jornadas }) => {
  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Operador</th>
            <th>Lote</th>
            <th>Actividad</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Horas</th>
            <th>Combustible Consumido</th>
            <th>Costo Estimado</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {jornadas.length > 0 ? (
            jornadas.map(j => (
              <tr key={j.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MachineIcon type={j.maquinariaType} size={14} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600' }}>{j.maquinariaCodigo}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{j.maquinariaName}</span>
                    </div>
                  </div>
                </td>
                <td style={{ fontWeight: '500' }}>{j.operator}</td>
                <td>{j.lot}</td>
                <td>{j.activity}</td>
                <td>{formatDateTime(j.startTime)}</td>
                <td>{j.endTime ? formatDateTime(j.endTime) : '--'}</td>
                <td>{j.status === 'Finalizada' ? `${j.calculatedHours.toFixed(1)} h` : 'En progreso'}</td>
                <td>{j.status === 'Finalizada' ? `${j.calculatedFuelConsumption} L` : '--'}</td>
                <td style={{ color: 'var(--primary)', fontWeight: '600' }}>
                  {j.status === 'Finalizada' ? formatCurrency(j.calculatedCost) : '--'}
                </td>
                <td>
                  <span className={`badge ${j.status === 'Finalizada' ? 'badge-green' : 'badge-blue'}`}>
                    {j.status}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                No hay registros de jornadas operativas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default OperationsTable;

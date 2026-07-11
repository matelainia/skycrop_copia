
import MachineStatusBadge from '../machinery/MachineStatusBadge';
import { formatCurrency } from '../../utils/formatters';

export const FuelTable = ({ machinery }) => {
  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Operador Asignado</th>
            <th>Consumo Estándar</th>
            <th>Horas Hoy</th>
            <th>Litros Consumidos Hoy</th>
            <th>Costo Combustible Hoy</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {machinery.map(m => {
            const burnRate = parseFloat(m.fuelConsumption) || 0;
            const consumed = m.status === 'Operando' ? burnRate * (m.hoursToday || 6) : 0;
            const cost = consumed * m.costFuel;
            return (
              <tr key={m.id}>
                <td><strong>{m.codigoId}</strong> - {m.name}</td>
                <td>{m.type}</td>
                <td>{m.operatorName || '--'}</td>
                <td>{m.fuelConsumption}</td>
                <td>{m.hoursToday > 0 ? `${m.hoursToday.toFixed(1)} h` : '0.0 h'}</td>
                <td>{consumed > 0 ? `${consumed.toFixed(1)} L` : '0.0 L'}</td>
                <td style={{ color: 'var(--primary)', fontWeight: '600' }}>
                  {cost > 0 ? formatCurrency(cost) : '--'}
                </td>
                <td><MachineStatusBadge status={m.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FuelTable;

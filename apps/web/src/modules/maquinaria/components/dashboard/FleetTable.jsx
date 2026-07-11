
import MachineryRow from '../machinery/MachineryRow';

export const FleetTable = ({
  paginatedMachinery,
  activeMachineId,
  setActiveMachineId,
  getActiveJornadaForMachine,
  onStartLabor,
  onEndLabor,
  onViewDetails,
  onEdit,
  onDelete
}) => {
  return (
    <div className="table-container" style={{ margin: 0 }}>
      <table className="custom-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Estado Actual</th>
            <th>Operador</th>
            <th>Labor Actual</th>
            <th>Horómetro</th>
            <th>Horas Hoy</th>
            <th style={{ textAlign: 'right', paddingRight: '20px' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {paginatedMachinery.length > 0 ? (
            paginatedMachinery.map(m => {
              const activeJornada = getActiveJornadaForMachine(m.id);
              return (
                <MachineryRow
                  key={m.id}
                  machine={m}
                  isActiveRow={activeMachineId === m.id}
                  activeJornada={activeJornada}
                  onRowClick={setActiveMachineId}
                  onStartLabor={onStartLabor}
                  onEndLabor={onEndLabor}
                  onViewDetails={onViewDetails}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })
          ) : (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                No se encontraron maquinarias.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FleetTable;

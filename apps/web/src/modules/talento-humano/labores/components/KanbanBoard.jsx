import React from 'react';
import LaborColumn from './LaborColumn';
import { LABOR_ESTADOS } from '../../constants/labores';

export const KanbanBoard = React.memo(function KanbanBoard({
  labores = [],
  workers = [],
  cuadrillas = [],
  onDeleteLabor,
  onChangeEstado
}) {
  return (
    <div className="labor-kanban">
      {LABOR_ESTADOS.map(estado => {
        const colLabores = labores.filter(l => l.estado === estado);
        return (
          <LaborColumn 
            key={estado} 
            estado={estado} 
            labores={colLabores} 
            workers={workers} 
            cuadrillas={cuadrillas} 
            onDeleteLabor={onDeleteLabor} 
            onChangeEstado={onChangeEstado} 
          />
        );
      })}
    </div>
  );
});

export default KanbanBoard;

import React from 'react';
import { Trash2 } from 'lucide-react';
import { getLaborAssigneeName } from '../../utils/laborHelpers';
import { LABOR_ESTADOS } from '../../constants/labores';

export const LaborCard = React.memo(function LaborCard({
  labor,
  workers = [],
  cuadrillas = [],
  onDeleteLabor,
  onChangeEstado
}) {
  return (
    <div className="labor-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div className="labor-card-title">{labor.titulo}</div>
          <div className="labor-card-meta">
            <span>{labor.tipo} {labor.lote ? `· Lote: ${labor.lote}` : ''}</span>
            <span>Fecha: {labor.fecha}</span>
            {labor.descripcion && <span style={{ fontStyle: 'italic' }}>{labor.descripcion}</span>}
          </div>
        </div>
        <button 
          className="btn btn-danger" 
          style={{ padding: '3px 6px', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
          onClick={() => onDeleteLabor(labor.id)}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="labor-card-workers">
        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%', marginBottom: 2 }}>
          {labor.asignacion === 'cuadrilla' ? 'Cuadrilla:' : 'Trabajadores:'}
        </span>
        <span className="worker-chip">
          {getLaborAssigneeName(labor, workers, cuadrillas)}
        </span>
      </div>

      {/* Estado changer */}
      <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
        {LABOR_ESTADOS.filter(e => e !== labor.estado).map(e => (
          <button 
            key={e} 
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '3px 8px', flexGrow: 1 }}
            onClick={() => onChangeEstado(labor.id, e)}
          >
            → {e}
          </button>
        ))}
      </div>
    </div>
  );
});

export default LaborCard;

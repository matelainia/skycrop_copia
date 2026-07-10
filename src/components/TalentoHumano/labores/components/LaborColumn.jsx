import React from 'react';
import LaborCard from './LaborCard';

export const LaborColumn = React.memo(function LaborColumn({
  estado,
  labores = [],
  workers = [],
  cuadrillas = [],
  onDeleteLabor,
  onChangeEstado
}) {
  const dotClass = estado === 'Pendiente' ? 'pendiente' : estado === 'En Curso' ? 'en-curso' : 'completada';
  const colColor = estado === 'Pendiente' ? 'var(--accent-gold)' : estado === 'En Curso' ? 'var(--accent-blue)' : 'var(--primary)';

  return (
    <div className="labor-column">
      <div className="labor-column-header" style={{ borderLeft: `3px solid ${colColor}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-dot ${dotClass}`} />
          {estado}
        </div>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{labores.length}</span>
      </div>

      {labores.length === 0 && (
        <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          Sin labores en este estado
        </div>
      )}

      {labores.map(labor => (
        <LaborCard 
          key={labor.id} 
          labor={labor} 
          workers={workers} 
          cuadrillas={cuadrillas} 
          onDeleteLabor={onDeleteLabor} 
          onChangeEstado={onChangeEstado} 
        />
      ))}
    </div>
  );
});

export default LaborColumn;

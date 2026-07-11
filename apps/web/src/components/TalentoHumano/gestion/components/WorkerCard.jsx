import React from 'react';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import { Eye, ToggleRight, Trash2 } from 'lucide-react';

export const WorkerCard = React.memo(function WorkerCard({
  worker,
  onViewWorker,
  onToggleStatus,
  onDeleteWorker
}) {
  if (!worker) return null;

  return (
    <div className="glass-card worker-card-responsive" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar worker={worker} size={42} />
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
            {worker.nombres} {worker.apellidos}
          </h4>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{worker.rol}</span>
        </div>
        <StatusBadge status={worker.estado} style={{ fontSize: 10, padding: '2px 8px' }} />
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div>
          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10 }}>Identificación</span>
          <strong>{worker.identificacion}</strong>
        </div>
        <div>
          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10 }}>Contrato</span>
          <strong>{worker.tipoContrato}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4, justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: 11, gap: 4, display: 'inline-flex', alignItems: 'center' }}
          onClick={() => onViewWorker(worker)}
        >
          <Eye size={13} /> <span>Ficha</span>
        </button>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: 11, gap: 4, display: 'inline-flex', alignItems: 'center' }}
          onClick={() => onToggleStatus(worker.id)}
        >
          <ToggleRight size={13} /> <span>Estado</span>
        </button>
        <button 
          className="btn btn-danger" 
          style={{ padding: '6px 12px', fontSize: 11, gap: 4, display: 'inline-flex', alignItems: 'center' }}
          onClick={() => onDeleteWorker(worker.id)}
        >
          <Trash2 size={13} /> <span>Eliminar</span>
        </button>
      </div>
    </div>
  );
});

export default WorkerCard;

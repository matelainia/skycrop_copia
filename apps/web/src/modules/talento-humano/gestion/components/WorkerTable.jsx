import React from 'react';
import { Eye, ToggleRight, Trash2, Users } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';

export const WorkerTable = React.memo(function WorkerTable({
  workers = [],
  onViewWorker,
  onToggleStatus,
  onDeleteWorker
}) {
  return (
    <div className="glass-card" style={{ padding: 0 }}>
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>Foto</th>
              <th>Nombre</th>
              <th>Identificación</th>
              <th>Rol</th>
              <th>Tipo de Contrato</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {workers.length > 0 ? (
              workers.map(w => (
                <tr key={w.id}>
                  <td>
                    <Avatar worker={w} />
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {w.nombres} {w.apellidos}
                  </td>
                  <td style={{ fontWeight: 500 }}>{w.identificacion}</td>
                  <td>{w.rol}</td>
                  <td>{w.tipoContrato}</td>
                  <td>
                    <StatusBadge status={w.estado} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '5px 8px' }}
                        title="Ver ficha" 
                        onClick={() => onViewWorker(w)}
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '5px 8px' }}
                        title="Cambiar estado" 
                        onClick={() => onToggleStatus(w.id)}
                      >
                        <ToggleRight size={14} />
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '5px 8px' }}
                        title="Eliminar" 
                        onClick={() => onDeleteWorker(w.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyState 
                    icon={Users} 
                    title="No hay trabajadores registrados" 
                    description="Haz clic en 'Agregar Trabajador' para comenzar." 
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default WorkerTable;

import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import MemberList from './MemberList';
import AddMemberModal from '../../modals/AddMemberModal';

export default function CuadrillaCard({
  cuadrilla,
  workers = [],
  isAddingMember,
  onStartAddMember,
  onCancelAddMember,
  onAddMember,
  onRemoveMember,
  onDeleteCuadrilla
}) {
  const memberWorkers = cuadrilla.miembros
    .map(id => workers.find(w => w.id === id))
    .filter(Boolean);

  const availableWorkers = workers.filter(w => !cuadrilla.miembros.includes(w.id));

  return (
    <div className="cuadrilla-manage-card">
      <div className="cuadrilla-manage-header">
        <h4>{cuadrilla.nombre}</h4>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {memberWorkers.length} miembros
          </span>
          <button 
            className="btn btn-danger" 
            style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
            title="Eliminar cuadrilla" 
            onClick={() => onDeleteCuadrilla(cuadrilla.id)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <MemberList 
        members={memberWorkers} 
        onRemoveMember={(workerId) => onRemoveMember(cuadrilla.id, workerId)} 
      />

      <div className="cuadrilla-add-member">
        {!isAddingMember ? (
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', fontSize: 13, gap: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => onStartAddMember(cuadrilla.id)}
          >
            <Plus size={14} /> Agregar miembro
          </button>
        ) : (
          <AddMemberModal 
            cuadrillaId={cuadrilla.id} 
            availableWorkers={availableWorkers} 
            onAddMember={onAddMember} 
            onCancel={onCancelAddMember} 
          />
        )}
      </div>
    </div>
  );
}

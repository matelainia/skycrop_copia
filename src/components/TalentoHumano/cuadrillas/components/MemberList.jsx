import React from 'react';
import { X } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';

export default function MemberList({ members = [], onRemoveMember }) {
  if (members.length === 0) {
    return (
      <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
        Sin miembros asignados
      </span>
    );
  }

  return (
    <div className="cuadrilla-members-list">
      {members.map(w => (
        <div key={w.id} className="cuadrilla-member-row">
          <Avatar worker={w} size={26} />
          <span>{w.nombres} {w.apellidos}</span>
          <StatusBadge status={w.estado} style={{ fontSize: 10, padding: '2px 7px' }} />
          <button title="Quitar de cuadrilla" onClick={() => onRemoveMember(w.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

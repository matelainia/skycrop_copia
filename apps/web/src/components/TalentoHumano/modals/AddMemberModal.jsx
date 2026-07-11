import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import Avatar from '../components/common/Avatar';

export default function AddMemberModal({ 
  cuadrillaId, 
  availableWorkers = [], 
  onAddMember, 
  onCancel 
}) {
  const [searchVal, setSearchVal] = useState('');

  const filtered = availableWorkers.filter(w => 
    `${w.nombres} ${w.apellidos}`.toLowerCase().includes(searchVal.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          className="input-glass" 
          style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
          placeholder="Buscar trabajador..."
          value={searchVal} 
          autoFocus
          onChange={e => setSearchVal(e.target.value)} 
        />
      </div>
      
      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
            No hay coincidencias
          </span>
        ) : (
          filtered.map(w => (
            <div 
              key={w.id} 
              className="cuadrilla-member-row" 
              style={{ cursor: 'pointer' }}
              onClick={() => onAddMember(cuadrillaId, w.id)}
            >
              <Avatar worker={w} size={24} />
              <span style={{ flexGrow: 1 }}>{w.nombres} {w.apellidos}</span>
              <Plus size={13} style={{ color: 'var(--primary)' }} />
            </div>
          ))
        )}
      </div>
      
      <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}

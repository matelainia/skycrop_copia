import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function CursoModal({ onSubmit, onClose }) {
  const [newCursoForm, setNewCursoForm] = useState({ 
    nombre: '', 
    tipo: 'Seguridad y Salud', 
    total_horas: 8 
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newCursoForm.nombre.trim()) return;
    onSubmit(newCursoForm);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crear Nuevo Curso</h3>
          <button className="btn btn-secondary" style={{ padding: 6 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Nombre del Curso *</label>
              <input 
                type="text" 
                className="input-glass" 
                style={{ width: '100%' }}
                placeholder="Ej. Taller de Poda Básica" 
                required
                value={newCursoForm.nombre} 
                onChange={e => setNewCursoForm(p => ({ ...p, nombre: e.target.value }))} 
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Tipo de Capacitación</label>
              <select 
                className="input-glass select-glass" 
                style={{ width: '100%' }}
                value={newCursoForm.tipo} 
                onChange={e => setNewCursoForm(p => ({ ...p, tipo: e.target.value }))}
              >
                <option value="Seguridad y Salud">Seguridad y Salud</option>
                <option value="Técnica">Técnica</option>
                <option value="Operación">Operación</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Horas Totales</label>
              <input 
                type="number" 
                className="input-glass" 
                style={{ width: '100%' }}
                min="1" 
                max="120"
                value={newCursoForm.total_horas} 
                onChange={e => setNewCursoForm(p => ({ ...p, total_horas: e.target.value }))} 
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                Crear Curso
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

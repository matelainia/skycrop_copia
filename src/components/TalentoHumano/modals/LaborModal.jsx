import React, { useState } from 'react';
import { X, UsersRound, UserCheck } from 'lucide-react';
import { TIPOS_LABOR, LABOR_ESTADOS } from '../constants/labores';
import Avatar from '../components/common/Avatar';

const EMPTY_LABOR_FORM = {
  titulo: '', tipo: 'Cosecha', descripcion: '',
  lote: '', fecha: new Date().toISOString().split('T')[0],
  estado: 'Pendiente',
  asignacion: 'cuadrilla',   // 'cuadrilla' | 'individual'
  cuadrillaId: '',
  trabajadoresIds: [],
  jornal: 1.0,
};

export default function LaborModal({ 
  workers = [], 
  cuadrillas = [], 
  onSubmit, 
  onClose 
}) {
  const [laborForm, setLaborForm] = useState({ ...EMPTY_LABOR_FORM });

  const lfChange = (field, value) => setLaborForm(p => ({ ...p, [field]: value }));

  const handleToggleWorkerInLabor = (workerId) => {
    setLaborForm(p => {
      const ids = p.trabajadoresIds || [];
      return { 
        ...p, 
        trabajadoresIds: ids.includes(workerId) ? ids.filter(i => i !== workerId) : [...ids, workerId] 
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!laborForm.titulo.trim()) return;
    onSubmit(laborForm);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Registrar Labor del Día</h3>
          <button className="btn btn-secondary" style={{ padding: 6 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {/* Título + Tipo */}
            <div className="form-group-container">
              <div>
                <label className="form-label">Actividad / Título *</label>
                <input 
                  type="text" 
                  className="input-glass" 
                  style={{ width: '100%' }}
                  placeholder="Ej. Cosecha Lote Norte" 
                  required
                  value={laborForm.titulo} 
                  onChange={e => lfChange('titulo', e.target.value)} 
                />
              </div>
              <div>
                <label className="form-label">Tipo de Labor</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }}
                  value={laborForm.tipo} 
                  onChange={e => lfChange('tipo', e.target.value)}
                >
                  {TIPOS_LABOR.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Lote + Fecha */}
            <div className="form-group-container">
              <div>
                <label className="form-label">Lote / Sector</label>
                <input 
                  type="text" 
                  className="input-glass" 
                  style={{ width: '100%' }}
                  placeholder="Ej. Lote A" 
                  value={laborForm.lote} 
                  onChange={e => lfChange('lote', e.target.value)} 
                />
              </div>
              <div>
                <label className="form-label">Fecha</label>
                <input 
                  type="date" 
                  className="input-glass" 
                  style={{ width: '100%' }}
                  value={laborForm.fecha} 
                  onChange={e => lfChange('fecha', e.target.value)} 
                />
              </div>
            </div>

            {/* Jornal + Estado */}
            <div className="form-group-container">
              <div>
                <label className="form-label">Jornal (Fracción de Día)</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }}
                  value={laborForm.jornal} 
                  onChange={e => lfChange('jornal', Number(e.target.value))}
                >
                  <option value="1.0">1.00 Jornal completo (8 hrs)</option>
                  <option value="0.75">0.75 Tres cuartos (6 hrs)</option>
                  <option value="0.5">0.50 Medio jornal (4 hrs)</option>
                  <option value="0.25">0.25 Un cuarto (2 hrs)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Estado Inicial</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }}
                  value={laborForm.estado} 
                  onChange={e => lfChange('estado', e.target.value)}
                >
                  {LABOR_ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Descripción */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Descripción</label>
              <textarea 
                className="input-glass" 
                style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                placeholder="Detalles específicos de la labor diaria..."
                value={laborForm.descripcion} 
                onChange={e => lfChange('descripcion', e.target.value)} 
              />
            </div>

            {/* Asignación */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Asignar a</label>
              <div className="toggle-group" style={{ marginBottom: 12 }}>
                <button 
                  type="button"
                  className={`toggle-btn ${laborForm.asignacion === 'cuadrilla' ? 'active' : ''}`}
                  onClick={() => lfChange('asignacion', 'cuadrilla')}
                >
                  <UsersRound size={14} style={{ marginRight: 4 }} /> Cuadrilla
                </button>
                <button 
                  type="button"
                  className={`toggle-btn ${laborForm.asignacion === 'individual' ? 'active' : ''}`}
                  onClick={() => lfChange('asignacion', 'individual')}
                >
                  <UserCheck size={14} style={{ marginRight: 4 }} /> Trabajadores individuales
                </button>
              </div>

              {laborForm.asignacion === 'cuadrilla' ? (
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }}
                  value={laborForm.cuadrillaId} 
                  onChange={e => lfChange('cuadrillaId', e.target.value)}
                >
                  <option value="">— Selecciona una cuadrilla —</option>
                  {cuadrillas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.miembros.length} miembros)</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 10, padding: 10 }}>
                  {workers.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No hay trabajadores registrados</span>
                  ) : (
                    workers.map(w => {
                      const selected = (laborForm.trabajadoresIds || []).includes(w.id);
                      return (
                        <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 6px', borderRadius: 8, background: selected ? 'var(--primary-light)' : 'transparent', fontSize: 13 }}>
                          <input 
                            type="checkbox" 
                            checked={selected} 
                            onChange={() => handleToggleWorkerInLabor(w.id)} 
                            style={{ accentColor: 'var(--primary)' }} 
                          />
                          <Avatar worker={w} size={24} />
                          <span>{w.nombres} {w.apellidos}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{w.rol}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                Registrar Labor
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

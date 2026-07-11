import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';

export default function RegistroModal({ 
  workers = [], 
  cursos = [], 
  onSubmit, 
  onClose 
}) {
  const [newRegistroForm, setNewRegistroForm] = useState({
    trabajadorId: '',
    cursoId: '',
    fecha: new Date().toISOString().split('T')[0],
    resultado: '10/10',
    estado: 'Completada',
    certificadoFileName: '',
    certificadoBase64: ''
  });
  const certUploadRef = useRef(null);

  const handleCertUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewRegistroForm(p => ({
        ...p,
        certificadoFileName: file.name,
        certificadoBase64: ev.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newRegistroForm.trabajadorId || !newRegistroForm.cursoId) {
      alert("Por favor selecciona un trabajador y un curso.");
      return;
    }
    onSubmit(newRegistroForm);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Registrar Registro de Capacitación</h3>
          <button className="btn btn-secondary" style={{ padding: 6 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Trabajador *</label>
              <select 
                className="input-glass select-glass" 
                style={{ width: '100%' }} 
                required
                value={newRegistroForm.trabajadorId} 
                onChange={e => setNewRegistroForm(p => ({ ...p, trabajadorId: e.target.value }))}
              >
                <option value="">— Selecciona un trabajador —</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.nombres} {w.apellidos} ({w.rol})</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Curso de Capacitación *</label>
              <select 
                className="input-glass select-glass" 
                style={{ width: '100%' }} 
                required
                value={newRegistroForm.cursoId} 
                onChange={e => setNewRegistroForm(p => ({ ...p, cursoId: e.target.value }))}
              >
                <option value="">— Selecciona un curso —</option>
                {cursos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>
                ))}
              </select>
            </div>

            <div className="form-group-container" style={{ gap: 12, marginBottom: 16 }}>
              <div>
                <label className="form-label">Fecha</label>
                <input 
                  type="date" 
                  className="input-glass" 
                  style={{ width: '100%' }} 
                  required
                  value={newRegistroForm.fecha} 
                  onChange={e => setNewRegistroForm(p => ({ ...p, fecha: e.target.value }))} 
                />
              </div>
              <div>
                <label className="form-label">Puntuación / Calificación</label>
                <input 
                  type="text" 
                  className="input-glass" 
                  style={{ width: '100%' }}
                  placeholder="Ej. 10/10 o En Curso" 
                  required
                  value={newRegistroForm.resultado} 
                  onChange={e => setNewRegistroForm(p => ({ ...p, resultado: e.target.value }))} 
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Estado</label>
              <div className="toggle-group">
                {['Completada', 'En Curso', 'Vencida'].map(st => (
                  <button 
                    type="button" 
                    key={st}
                    className={`toggle-btn ${newRegistroForm.estado === st ? 'active' : ''}`}
                    onClick={() => setNewRegistroForm(p => ({ 
                      ...p, 
                      estado: st, 
                      resultado: st === 'En Curso' ? 'En Curso' : p.resultado 
                    }))}
                  >
                    {st === 'Vencida' ? 'Vencida' : st}
                  </button>
                ))}
              </div>
            </div>

            {newRegistroForm.estado === 'Completada' && (
              <div style={{ marginBottom: 20 }}>
                <label className="form-label">Subir Certificado Diseñado</label>
                <div className="file-upload-zone" onClick={() => certUploadRef.current?.click()}>
                  <Upload size={20} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {newRegistroForm.certificadoFileName || 'Haz clic para seleccionar el certificado'}
                  </span>
                  <input 
                    ref={certUploadRef} 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }} 
                    onChange={handleCertUpload} 
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                Registrar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

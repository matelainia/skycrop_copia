import React, { useState, useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { ROLES } from '../../constants/roles';
import { TIPOS_CONTRATO } from '../../constants/contratos';
import { TIPOS_EPS } from '../../constants/eps';
import { TIPOS_ARL } from '../../constants/arl';
import { RH_OPTIONS } from '../../constants/rh';
import { calcularEdad } from '../../utils/workerHelpers';

const EMPTY_WORKER_FORM = {
  nombres: '', apellidos: '', identificacion: '',
  edad: '', fechaNacimiento: '', fechaContratacion: '',
  tipoContrato: 'Permanente', rhSanguineo: 'O+',
  tipoEps: 'Nueva EPS', tipoArl: 'Positiva',
  contactoTelefonico: '', contactoEmergencia: '',
  foto: null, copiaContratoName: '',
  rol: 'Operario General', estado: 'Activa',
};

export default function WorkerForm({ onSubmit, onCancel }) {
  const [workerForm, setWorkerForm] = useState({ ...EMPTY_WORKER_FORM });
  const photoRef = useRef(null);
  const contratoRef = useRef(null);

  const wfChange = (field, value) => {
    setWorkerForm(p => ({ ...p, [field]: value }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => wfChange('foto', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleContratoUpload = (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    wfChange('copiaContratoName', file.name);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!workerForm.nombres.trim() || !workerForm.apellidos.trim() || !workerForm.identificacion.trim()) return;
    onSubmit(workerForm);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Photo */}
      <div className="photo-upload-zone" onClick={() => photoRef.current?.click()}>
        {workerForm.foto ? (
          <img src={workerForm.foto} alt="preview" />
        ) : (
          <>
            <Camera size={24} style={{ color: 'var(--text-muted)', marginBottom: 4 }} />
            <span className="upload-hint">Subir foto del trabajador</span>
          </>
        )}
        <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
      </div>

      {/* Names */}
      <div className="form-group-container">
        <div>
          <label className="form-label">Nombres *</label>
          <input type="text" className="input-glass" style={{ width: '100%' }}
            placeholder="Ej. Juan Carlos" required
            value={workerForm.nombres} onChange={e => wfChange('nombres', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Apellidos *</label>
          <input type="text" className="input-glass" style={{ width: '100%' }}
            placeholder="Ej. Pérez López" required
            value={workerForm.apellidos} onChange={e => wfChange('apellidos', e.target.value)} />
        </div>
      </div>

      {/* ID + Birth */}
      <div className="form-group-container">
        <div>
          <label className="form-label">Identificación (CC) *</label>
          <input type="text" className="input-glass" style={{ width: '100%' }}
            placeholder="Ej. 1001234567" required
            value={workerForm.identificacion} onChange={e => wfChange('identificacion', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Fecha de Nacimiento</label>
          <input type="date" className="input-glass" style={{ width: '100%' }}
            value={workerForm.fechaNacimiento}
            onChange={e => setWorkerForm(p => ({ ...p, fechaNacimiento: e.target.value, edad: calcularEdad(e.target.value) }))} />
        </div>
      </div>

      {/* Age + Hire */}
      <div className="form-group-container">
        <div>
          <label className="form-label">Edad</label>
          <input type="number" className="input-glass" style={{ width: '100%' }}
            placeholder="Se calcula automáticamente"
            value={workerForm.edad} readOnly={!!workerForm.fechaNacimiento}
            onChange={e => wfChange('edad', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Fecha de Contratación</label>
          <input type="date" className="input-glass" style={{ width: '100%' }}
            value={workerForm.fechaContratacion}
            onChange={e => wfChange('fechaContratacion', e.target.value)} />
        </div>
      </div>

      {/* Contract + Role */}
      <div className="form-group-container">
        <div>
          <label className="form-label">Tipo de Contrato</label>
          <select className="input-glass select-glass" style={{ width: '100%' }}
            value={workerForm.tipoContrato} onChange={e => wfChange('tipoContrato', e.target.value)}>
            {TIPOS_CONTRATO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Rol / Cargo</label>
          <select className="input-glass select-glass" style={{ width: '100%' }}
            value={workerForm.rol} onChange={e => wfChange('rol', e.target.value)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* RH + EPS */}
      <div className="form-group-container">
        <div>
          <label className="form-label">RH Sanguíneo</label>
          <select className="input-glass select-glass" style={{ width: '100%' }}
            value={workerForm.rhSanguineo} onChange={e => wfChange('rhSanguineo', e.target.value)}>
            {RH_OPTIONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Tipo de EPS</label>
          <select className="input-glass select-glass" style={{ width: '100%' }}
            value={workerForm.tipoEps} onChange={e => wfChange('tipoEps', e.target.value)}>
            {TIPOS_EPS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* ARL + Phone */}
      <div className="form-group-container">
        <div>
          <label className="form-label">Tipo de ARL</label>
          <select className="input-glass select-glass" style={{ width: '100%' }}
            value={workerForm.tipoArl} onChange={e => wfChange('tipoArl', e.target.value)}>
            {TIPOS_ARL.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Contacto Telefónico</label>
          <input type="tel" className="input-glass" style={{ width: '100%' }}
            placeholder="Ej. +57 312 345 6789"
            value={workerForm.contactoTelefonico} onChange={e => wfChange('contactoTelefonico', e.target.value)} />
        </div>
      </div>

      {/* Emergency contact */}
      <div className="form-group-container">
        <div>
          <label className="form-label">Contacto de Emergencia</label>
          <input type="tel" className="input-glass" style={{ width: '100%' }}
            placeholder="Ej. +57 300 987 6543"
            value={workerForm.contactoEmergencia} onChange={e => wfChange('contactoEmergencia', e.target.value)} />
        </div>
      </div>

      {/* Contract file */}
      <div>
        <label className="form-label">Anexar Copia del Contrato</label>
        <div className="file-upload-zone" onClick={() => contratoRef.current?.click()}>
          <Upload size={20} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Haz clic para seleccionar el archivo
          </span>
          {workerForm.copiaContratoName && (
            <span className="file-name">{workerForm.copiaContratoName}</span>
          )}
          <input ref={contratoRef} type="file" accept=".pdf,.doc,.docx,.jpg,.png"
            style={{ display: 'none' }} onChange={handleContratoUpload} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
          Registrar Trabajador
        </button>
      </div>
    </form>
  );
}

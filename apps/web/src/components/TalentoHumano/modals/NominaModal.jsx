import React, { useState } from 'react';
import { X } from 'lucide-react';
import Avatar from '../components/common/Avatar';

export default function NominaModal({
  selectedNomina = null,
  workers = [],
  initialPeriod = 'Abril',
  onSubmit,
  onClose
}) {
  const isEdit = !!selectedNomina;
  
  const [form, setForm] = useState(selectedNomina ? {
    trabajadorId: selectedNomina.trabajador_id,
    periodo: selectedNomina.periodo,
    salarioNeto: selectedNomina.salario_neto,
    horasExtras: selectedNomina.horas_extras,
    retenciones: selectedNomina.retenciones,
    estado: selectedNomina.estado,
    fechaPago: selectedNomina.fecha_pago || '',
    metodoPago: selectedNomina.metodo_pago || 'Transferencia Bancaria',
    comentarios: selectedNomina.comentarios || ''
  } : {
    trabajadorId: '',
    periodo: initialPeriod,
    salarioNeto: 3500000,
    horasExtras: 0,
    retenciones: 0,
    estado: 'Procesando',
    fechaPago: '',
    metodoPago: 'Transferencia Bancaria',
    comentarios: ''
  });

  const handleTrabajadorChange = (wId) => {
    const w = workers.find(work => work.id === wId);
    const baseSalary = w ? (w.rol === 'Tractorista' ? 4250000 : w.rol === 'Supervisor de Campo' ? 5500000 : 3500000) : 3500000;
    setForm(p => ({ ...p, trabajadorId: wId, salarioNeto: baseSalary }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.trabajadorId || !form.periodo) {
      alert("Por favor selecciona un trabajador y un período.");
      return;
    }
    onSubmit(form);
  };

  const activeWorkers = workers.filter(w => w.estado === 'Activa');
  const currentWorker = workers.find(w => w.id === form.trabajadorId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Editar Registro de Pago' : 'Registrar Pago de Nómina'}</h3>
          <button className="btn btn-secondary" style={{ padding: 6 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {isEdit && currentWorker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--primary-light)' }}>
              <Avatar worker={currentWorker} size={36} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{currentWorker.nombres} {currentWorker.apellidos}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{currentWorker.rol} · CC: {currentWorker.identificacion}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!isEdit && (
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Trabajador *</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }} 
                  required
                  value={form.trabajadorId} 
                  onChange={e => handleTrabajadorChange(e.target.value)}
                >
                  <option value="">— Selecciona un trabajador activo —</option>
                  {activeWorkers.map(w => (
                    <option key={w.id} value={w.id}>{w.nombres} {w.apellidos} ({w.rol})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
              <div>
                <label className="form-label">Periodo (Mes) *</label>
                {isEdit ? (
                  <input type="text" className="input-glass" style={{ width: '100%' }} readOnly value={form.periodo} />
                ) : (
                  <select 
                    className="input-glass select-glass" 
                    style={{ width: '100%' }} 
                    required
                    value={form.periodo} 
                    onChange={e => setForm(p => ({ ...p, periodo: e.target.value }))}
                  >
                    <option value="Enero">Enero</option>
                    <option value="Febrero">Febrero</option>
                    <option value="Marzo">Marzo</option>
                    <option value="Abril">Abril</option>
                    <option value="Mayo">Mayo</option>
                  </select>
                )}
              </div>
              <div>
                <label className="form-label">Estado de Pago *</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }} 
                  required
                  value={form.estado} 
                  onChange={e => setForm(p => ({ 
                    ...p, 
                    estado: e.target.value, 
                    fechaPago: e.target.value === 'Completado' ? (p.fechaPago || new Date().toISOString().split('T')[0]) : '' 
                  }))}
                >
                  <option value="Procesando">Procesando</option>
                  <option value="Completado">Completado</option>
                  <option value="Fallido">Fallido</option>
                  <option value="Vencida">Vencida</option>
                </select>
              </div>
            </div>

            <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
              <div>
                <label className="form-label">Salario Base (COP) *</label>
                <input 
                  type="number" 
                  className="input-glass" 
                  style={{ width: '100%' }} 
                  required
                  value={form.salarioNeto} 
                  onChange={e => setForm(p => ({ ...p, salarioNeto: Number(e.target.value) }))} 
                />
              </div>
              <div>
                <label className="form-label">Horas Extras *</label>
                <input 
                  type="number" 
                  className="input-glass" 
                  style={{ width: '100%' }} 
                  required 
                  min="0"
                  value={form.horasExtras} 
                  onChange={e => setForm(p => ({ ...p, horasExtras: Number(e.target.value) }))} 
                />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Valor H.E: $15.000 COP</span>
              </div>
            </div>

            <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
              <div>
                <label className="form-label">Retenciones / Descuentos *</label>
                <input 
                  type="number" 
                  className="input-glass" 
                  style={{ width: '100%' }} 
                  required 
                  min="0"
                  value={form.retenciones} 
                  onChange={e => setForm(p => ({ ...p, retenciones: Number(e.target.value) }))} 
                />
              </div>
              <div>
                <label className="form-label">Método de Pago</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ width: '100%' }}
                  value={form.metodoPago} 
                  onChange={e => setForm(p => ({ ...p, metodoPago: e.target.value }))}
                >
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            {form.estado === 'Completado' && (
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Fecha de Pago *</label>
                <input 
                  type="date" 
                  className="input-glass" 
                  style={{ width: '100%' }} 
                  required
                  value={form.fechaPago} 
                  onChange={e => setForm(p => ({ ...p, fechaPago: e.target.value }))} 
                />
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label className="form-label">Comentarios / Incidentes</label>
              <textarea 
                className="input-glass" 
                style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                placeholder="Notas sobre el pago, motivo de fallo o vencimiento..."
                value={form.comentarios} 
                onChange={e => setForm(p => ({ ...p, comentarios: e.target.value }))} 
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                {isEdit ? 'Guardar Cambios' : 'Registrar Pago'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

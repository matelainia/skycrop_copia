
import { X } from 'lucide-react';

export const EndLaborModal = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Finalizar Labor Agrícola</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="drawer-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="form-label">Horómetro Final</label>
              <input
                type="number"
                step="0.01"
                className="input-glass"
                style={{ width: '100%', fontSize: '13px' }}
                required
                value={formData.endHorometro}
                onChange={e => setFormData(prev => ({ ...prev, endHorometro: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="form-label">Combustible Restante (L)</label>
              <input
                type="number"
                className="input-glass"
                style={{ width: '100%', fontSize: '13px' }}
                required
                value={formData.endFuel}
                onChange={e => setFormData(prev => ({ ...prev, endFuel: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Hora Final</label>
            <input
              type="datetime-local"
              className="input-glass"
              style={{ width: '100%', fontSize: '13px' }}
              required
              value={formData.endTime}
              onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">Observaciones / Notas del día</label>
            <textarea
              className="input-glass"
              style={{ width: '100%', minHeight: '60px', fontSize: '13px', resize: 'vertical' }}
              placeholder="Ej. Preparación completada, terreno en buenas condiciones..."
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <button type="submit" className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            Guardar y Detener Maquinaria
          </button>
        </form>
      </div>
    </div>
  );
};

export default EndLaborModal;

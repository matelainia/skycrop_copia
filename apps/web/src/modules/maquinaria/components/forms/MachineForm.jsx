
import { Plus, Tractor } from 'lucide-react';
import { MACHINERY_TYPES_LIST } from '../../constants/machineryTypes';
import { MACHINERY_STATUS_LIST } from '../../constants/machineryStatus';

export const MachineForm = ({
  formData,
  setFormData,
  onImageUpload,
  uploading,
  isEdit = false
}) => {
  return (
    <>
      <div className="form-group-container">
        <div>
          <label className="form-label">Código ID {isEdit ? '(Fijo)' : '(Placa/Interno)'}</label>
          <input
            type="text"
            className="input-glass"
            style={{ width: '100%' }}
            placeholder="Ej. TR-001"
            required
            disabled={isEdit}
            value={formData.codigoId}
            onChange={e => setFormData(prev => ({ ...prev, codigoId: e.target.value }))}
          />
        </div>
        <div>
          <label className="form-label">Nombre del Equipo</label>
          <input
            type="text"
            className="input-glass"
            style={{ width: '100%' }}
            placeholder="Ej. Tractor John Deere 6195R"
            required
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>
      </div>

      <div className="form-group-container">
        <div>
          <label className="form-label">Tipo de Equipo</label>
          <select
            className="input-glass select-glass"
            style={{ width: '100%' }}
            value={formData.type}
            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
          >
            {MACHINERY_TYPES_LIST.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Consumo Estimado (L/h)</label>
          <input
            type="text"
            className="input-glass"
            style={{ width: '100%' }}
            placeholder="Ej. 15.5 L/h o Eléctrico"
            value={formData.fuelConsumption}
            onChange={e => setFormData(prev => ({ ...prev, fuelConsumption: e.target.value }))}
          />
        </div>
      </div>

      <div className="form-group-container">
        <div>
          <label className="form-label">Horómetro de Operación</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%' }}
            value={formData.hoursOfOperation}
            onChange={e => setFormData(prev => ({ ...prev, hoursOfOperation: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className="form-label">Mto. Frecuencia (Horas)</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%' }}
            placeholder="Ej. 250"
            value={formData.nextMaintenanceHours}
            onChange={e => setFormData(prev => ({ ...prev, nextMaintenanceHours: parseInt(e.target.value) || 250 }))}
          />
        </div>
      </div>

      <div className="form-group-container">
        <div>
          <label className="form-label">Costo Operador ($/h)</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%' }}
            value={formData.costOperator}
            onChange={e => setFormData(prev => ({ ...prev, costOperator: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className="form-label">Costo Combustible ($/h)</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%' }}
            value={formData.costFuel}
            onChange={e => setFormData(prev => ({ ...prev, costFuel: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="form-group-container">
        <div>
          <label className="form-label">Costo Mantenimiento ($/h)</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%' }}
            value={formData.costMaintenance}
            onChange={e => setFormData(prev => ({ ...prev, costMaintenance: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className="form-label">Costo Depreciación ($/h)</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%' }}
            value={formData.costDepreciation}
            onChange={e => setFormData(prev => ({ ...prev, costDepreciation: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div>
        <label className="form-label">Foto del Equipo</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {uploading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--primary-light)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Subiendo imagen...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {formData.photoUrl ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={formData.photoUrl}
                    alt="Vista previa"
                    style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                    style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-red)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '9px' }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <Tractor size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <input
                  type="file"
                  accept="image/*"
                  id={isEdit ? "edit-photo-file-form" : "add-photo-file-form"}
                  style={{ display: 'none' }}
                  onChange={(e) => onImageUpload(e, isEdit)}
                />
                <label
                  htmlFor={isEdit ? "edit-photo-file-form" : "add-photo-file-form"}
                  className="btn btn-secondary"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={14} />
                  <span>Seleccionar archivo</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="form-label">Estado</label>
        <select
          className="input-glass select-glass"
          style={{ width: '100%' }}
          value={formData.status}
          onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
        >
          {MACHINERY_STATUS_LIST.map(st => (
            <option key={st} value={st}>{st === 'En mantenimiento' ? 'En mantenimiento' : st}</option>
          ))}
        </select>
      </div>
    </>
  );
};

export default MachineForm;

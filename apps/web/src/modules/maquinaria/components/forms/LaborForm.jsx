
import { LABOR_ACTIVITIES_LIST } from '../../constants/laborActivities';

export const LaborForm = ({
  formData,
  setFormData,
  availableMachinery
}) => {
  return (
    <>
      <div>
        <label className="form-label">Maquinaria Disponible</label>
        <select
          className="input-glass select-glass"
          style={{ width: '100%', fontSize: '13px' }}
          required
          value={formData.maquinariaId}
          onChange={e => {
            const id = e.target.value;
            const target = availableMachinery.find(m => m.id === id);
            setFormData(prev => ({
              ...prev,
              maquinariaId: id,
              startHorometro: target ? target.hoursOfOperation : 0
            }));
          }}
        >
          <option value="">-- Seleccionar Equipo --</option>
          {availableMachinery.map(m => (
            <option key={m.id} value={m.id}>
              {m.codigoId} - {m.name} ({m.hoursOfOperation.toLocaleString()} h)
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label className="form-label">Operador Asignado</label>
          <input
            type="text"
            className="input-glass"
            style={{ width: '100%', fontSize: '13px' }}
            placeholder="Ej. Juan Pérez"
            required
            value={formData.operator}
            onChange={e => setFormData(prev => ({ ...prev, operator: e.target.value }))}
          />
        </div>
        <div>
          <label className="form-label">Lote / Campo</label>
          <input
            type="text"
            className="input-glass"
            style={{ width: '100%', fontSize: '13px' }}
            placeholder="Ej. Lote B-12"
            required
            value={formData.lot}
            onChange={e => setFormData(prev => ({ ...prev, lot: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="form-label">Actividad Agrícola</label>
        <select
          className="input-glass select-glass"
          style={{ width: '100%', fontSize: '13px' }}
          value={formData.activity}
          onChange={e => setFormData(prev => ({ ...prev, activity: e.target.value }))}
        >
          {LABOR_ACTIVITIES_LIST.map(act => (
            <option key={act} value={act}>{act}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label className="form-label">Horómetro Inicial</label>
          <input
            type="number"
            step="0.01"
            className="input-glass"
            style={{ width: '100%', fontSize: '13px' }}
            required
            value={formData.startHorometro}
            onChange={e => setFormData(prev => ({ ...prev, startHorometro: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className="form-label">Combustible Inicial (L)</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%', fontSize: '13px' }}
            required
            value={formData.startFuel}
            onChange={e => setFormData(prev => ({ ...prev, startFuel: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div>
        <label className="form-label">Hora de Inicio</label>
        <input
          type="datetime-local"
          className="input-glass"
          style={{ width: '100%', fontSize: '13px' }}
          required
          value={formData.startTime}
          onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
        />
      </div>
    </>
  );
};

export default LaborForm;

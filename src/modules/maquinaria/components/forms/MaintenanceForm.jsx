

export const MaintenanceForm = ({
  formData,
  setFormData,
  machineryList
}) => {
  return (
    <>
      <div>
        <label className="form-label">Equipo de Flota</label>
        <select
          className="input-glass select-glass"
          style={{ width: '100%', fontSize: '13px' }}
          required
          value={formData.maquinariaId}
          onChange={e => {
            const id = e.target.value;
            const target = machineryList.find(m => m.id === id);
            setFormData(prev => ({
              ...prev,
              maquinariaId: id,
              horometro: target ? target.hoursOfOperation : 0
            }));
          }}
        >
          <option value="">-- Seleccionar Equipo --</option>
          {machineryList.map(m => (
            <option key={m.id} value={m.id}>{m.codigoId} - {m.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label className="form-label">Fecha del Servicio</label>
          <input
            type="date"
            className="input-glass"
            style={{ width: '100%', fontSize: '13px' }}
            required
            value={formData.date}
            onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
          />
        </div>
        <div>
          <label className="form-label">Horómetro de Servicio</label>
          <input
            type="number"
            className="input-glass"
            style={{ width: '100%', fontSize: '13px' }}
            required
            value={formData.horometro}
            onChange={e => setFormData(prev => ({ ...prev, horometro: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div>
        <label className="form-label">Notas del Servicio / Ajustes</label>
        <textarea
          className="input-glass"
          style={{ width: '100%', minHeight: '60px', fontSize: '13px', resize: 'vertical' }}
          placeholder="Ej. Cambio de filtros, aceite hidráulico, lubricación de uniones..."
          value={formData.notes}
          onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        />
      </div>
    </>
  );
};

export default MaintenanceForm;

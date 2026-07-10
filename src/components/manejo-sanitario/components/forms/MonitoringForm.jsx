import React from 'react';
import { useMonitoringContext } from '../../context/MonitoringContext';
import { useLotsContext } from '../../context/LotsContext';

export default function MonitoringForm() {
  const { lotes } = useLotsContext();
  const { newMonitoreo, setNewMonitoreo, addMonitoreo, setIsMonDrawerOpen } = useMonitoringContext();

  const handleSubmit = (e) => {
    e.preventDefault();
    addMonitoreo();
  };

  return (
    <form className="drawer-form" onSubmit={handleSubmit}>
      <div>
        <label className="form-label">Lote</label>
        <select 
          className="input-glass select-glass" 
          style={{ width: '100%' }} 
          value={newMonitoreo.lote_id} 
          onChange={e => setNewMonitoreo(p => ({ ...p, lote_id: e.target.value }))}
        >
          <option value="" disabled>Seleccione un lote</option>
          {lotes.map(l => (
            <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
          ))}
        </select>
      </div>
      <div className="form-group-container">
        <div>
          <label className="form-label">Responsable</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newMonitoreo.responsable} 
            onChange={e => setNewMonitoreo(p => ({ ...p, responsable: e.target.value }))} 
          />
        </div>
        <div>
          <label className="form-label">Incidencia (%)</label>
          <input 
            type="number" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newMonitoreo.incidencia_pct} 
            onChange={e => setNewMonitoreo(p => ({ ...p, incidencia_pct: e.target.value }))} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsMonDrawerOpen(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, background: 'var(--primary)' }}>Guardar Monitoreo</button>
      </div>
    </form>
  );
}

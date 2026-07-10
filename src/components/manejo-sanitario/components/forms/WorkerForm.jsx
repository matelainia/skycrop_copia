import React from 'react';
import { useMonitoringContext } from '../../context/MonitoringContext';
import { useLotsContext } from '../../context/LotsContext';

export default function WorkerForm() {
  const { lotes } = useLotsContext();
  const { newTrabajador, setNewTrabajador, addTrabajadorLog, setIsTrabajadorDrawerOpen } = useMonitoringContext();

  const handleSubmit = (e) => {
    e.preventDefault();
    addTrabajadorLog();
  };

  return (
    <form className="drawer-form" onSubmit={handleSubmit}>
      <div>
        <label className="form-label">Lote Destino</label>
        <select 
          className="input-glass select-glass" 
          style={{ width: '100%' }} 
          value={newTrabajador.lote_id} 
          onChange={e => setNewTrabajador(p => ({ ...p, lote_id: e.target.value }))}
        >
          <option value="" disabled>Seleccione un lote</option>
          {lotes.map(l => (
            <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Nombre del Trabajador</label>
        <input 
          type="text" 
          className="input-glass" 
          style={{ width: '100%' }} 
          placeholder="Ej. Carlos Ruiz" 
          required 
          value={newTrabajador.nombre} 
          onChange={e => setNewTrabajador(p => ({ ...p, nombre: e.target.value }))} 
        />
      </div>
      <div className="form-group-container">
        <div>
          <label className="form-label">Labor a Realizar</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            placeholder="Ej. Deshierbe" 
            required 
            value={newTrabajador.actividad_realizada} 
            onChange={e => setNewTrabajador(p => ({ ...p, actividad_realizada: e.target.value }))} 
          />
        </div>
        <div>
          <label className="form-label">Tiempo Estimado (Hrs)</label>
          <input 
            type="number" 
            step="0.5" 
            className="input-glass" 
            style={{ width: '100%' }} 
            placeholder="Ej. 4.5" 
            required 
            value={newTrabajador.tiempo_permanencia_hours} 
            onChange={e => setNewTrabajador(p => ({ ...p, tiempo_permanencia_hours: e.target.value }))} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsTrabajadorDrawerOpen(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, background: 'var(--primary)' }}>Registrar Ingreso</button>
      </div>
    </form>
  );
}

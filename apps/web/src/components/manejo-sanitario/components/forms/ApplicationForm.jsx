import React from 'react';
import { useApplicationsContext } from '../../context/ApplicationsContext';
import { useLotsContext } from '../../context/LotsContext';

export default function ApplicationForm() {
  const { lotes } = useLotsContext();
  const { newAplicacion, setNewAplicacion, addAplicacion, setIsAppDrawerOpen } = useApplicationsContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addAplicacion();
  };


  return (
    <form className="drawer-form" onSubmit={handleSubmit}>
      <div>
        <label className="form-label">Lote</label>
        <select 
          className="input-glass select-glass" 
          style={{ width: '100%' }} 
          value={newAplicacion.lote_id} 
          onChange={e => setNewAplicacion(p => ({ ...p, lote_id: e.target.value }))}
        >
          <option value="" disabled>Seleccione un lote</option>
          {lotes.map(l => (
            <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
          ))}
        </select>
      </div>
      <div className="form-group-container">
        <div>
          <label className="form-label">Producto Comercial</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            placeholder="Ej. Azoxistrobin" 
            required 
            value={newAplicacion.producto_comercial} 
            onChange={e => setNewAplicacion(p => ({ ...p, producto_comercial: e.target.value }))} 
          />
        </div>
        <div>
          <label className="form-label">Dosis</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            placeholder="Ej. 0.5 L/ha" 
            required 
            value={newAplicacion.dosis} 
            onChange={e => setNewAplicacion(p => ({ ...p, dosis: e.target.value }))} 
          />
        </div>
      </div>
      <div className="form-group-container">
        <div>
          <label className="form-label">Carencia (Días)</label>
          <input 
            type="number" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newAplicacion.periodo_carencia_dias} 
            onChange={e => setNewAplicacion(p => ({ ...p, periodo_carencia_dias: e.target.value }))} 
          />
        </div>
        <div>
          <label className="form-label">Costo (COP)</label>
          <input 
            type="number" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newAplicacion.costo_aplicacion} 
            onChange={e => setNewAplicacion(p => ({ ...p, costo_aplicacion: e.target.value }))} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsAppDrawerOpen(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, background: 'var(--primary)' }}>Guardar Aplicación</button>
      </div>
    </form>
  );
}

import React from 'react';
import { useMonitoringContext } from '../../context/MonitoringContext';
import { useLotsContext } from '../../context/LotsContext';

export default function CostoForm() {
  const { lotes } = useLotsContext();
  const { newCosto, setNewCosto, addCosto, setIsCostoDrawerOpen } = useMonitoringContext();

  const handleSubmit = (e) => {
    e.preventDefault();
    addCosto();
  };

  return (
    <form className="drawer-form" onSubmit={handleSubmit}>
      <div>
        <label className="form-label">Lote Afectado</label>
        <select 
          className="input-glass select-glass" 
          style={{ width: '100%' }} 
          value={newCosto.lote_id} 
          onChange={e => setNewCosto(p => ({ ...p, lote_id: e.target.value }))}
        >
          <option value="" disabled>Seleccione un lote</option>
          {lotes.map(l => (
            <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
          ))}
        </select>
      </div>
      <div className="form-group-container">
        <div>
          <label className="form-label">Categoría</label>
          <select 
            className="input-glass select-glass" 
            style={{ width: '100%' }} 
            value={newCosto.categoria} 
            onChange={e => setNewCosto(p => ({ ...p, categoria: e.target.value }))}
          >
            <option value="Aplicaciones">Aplicaciones</option>
            <option value="Mano de Obra">Mano de Obra</option>
            <option value="Maquinaria">Maquinaria</option>
            <option value="Combustible">Combustible</option>
            <option value="Fertilización">Fertilización</option>
            <option value="Riego">Riego</option>
          </select>
        </div>
        <div>
          <label className="form-label">Costo (COP)</label>
          <input 
            type="number" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newCosto.costo} 
            onChange={e => setNewCosto(p => ({ ...p, costo: e.target.value }))} 
          />
        </div>
      </div>
      <div>
        <label className="form-label">Descripción</label>
        <input 
          type="text" 
          className="input-glass" 
          style={{ width: '100%' }} 
          required 
          value={newCosto.descripcion} 
          onChange={e => setNewCosto(p => ({ ...p, descripcion: e.target.value }))} 
        />
      </div>
      <div>
        <label className="form-label">Responsable Autorización</label>
        <input 
          type="text" 
          className="input-glass" 
          style={{ width: '100%' }} 
          placeholder="Ej. Andrés Castro" 
          required 
          value={newCosto.responsable} 
          onChange={e => setNewCosto(p => ({ ...p, responsable: e.target.value }))} 
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsCostoDrawerOpen(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, background: 'var(--primary)' }}>Registrar Costo</button>
      </div>
    </form>
  );
}

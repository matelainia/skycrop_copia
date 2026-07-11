import React from 'react';
import { useApplicationsContext } from '../../context/ApplicationsContext';
import { useLotsContext } from '../../context/LotsContext';

export default function CosechaForm() {
  const { lotes } = useLotsContext();
  const { newCosecha, setNewCosecha, addCosecha, setIsCosechaDrawerOpen } = useApplicationsContext();

  const handleSubmit = (e) => {
    e.preventDefault();
    addCosecha();
  };

  return (
    <form className="drawer-form" onSubmit={handleSubmit}>
      <div>
        <label className="form-label">Lote</label>
        <select 
          className="input-glass select-glass" 
          style={{ width: '100%' }} 
          value={newCosecha.lote_id} 
          onChange={e => setNewCosecha(p => ({ 
            ...p, 
            lote_id: e.target.value, 
            area_programada_ha: lotes.find(l => l.id === e.target.value)?.area_ha || 0 
          }))}
        >
          <option value="" disabled>Seleccione un lote</option>
          {lotes.map(l => (
            <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
          ))}
        </select>
      </div>
      <div className="form-group-container">
        <div>
          <label className="form-label">Fecha Programada</label>
          <input 
            type="date" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newCosecha.fecha_programada} 
            onChange={e => setNewCosecha(p => ({ ...p, fecha_programada: e.target.value }))} 
          />
        </div>
        <div>
          <label className="form-label">Área (ha)</label>
          <input 
            type="number" 
            step="0.01" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newCosecha.area_programada_ha} 
            onChange={e => setNewCosecha(p => ({ ...p, area_programada_ha: e.target.value }))} 
          />
        </div>
      </div>
      <div>
        <label className="form-label">Producción Estimada (kg)</label>
        <input 
          type="number" 
          className="input-glass" 
          style={{ width: '100%' }} 
          required 
          value={newCosecha.produccion_estimada_kg} 
          onChange={e => setNewCosecha(p => ({ ...p, produccion_estimada_kg: e.target.value }))} 
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsCosechaDrawerOpen(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, background: 'var(--primary)' }}>Validar y Guardar</button>
      </div>
    </form>
  );
}

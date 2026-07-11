import React from 'react';
import { UploadCloud } from 'lucide-react';
import { useLotsContext } from '../../context/LotsContext';

export default function LotForm() {
  const { newLote, setNewLote, handleFileUpload, handleAddLote, setIsLoteDrawerOpen, logAudit } = useLotsContext();

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAddLote(logAudit);
  };

  return (
    <form className="drawer-form" onSubmit={handleSubmit}>
      <div>
        <label className="form-label">Cargar Archivo Espacial</label>
        <div className="upload-dropzone-container">
          <UploadCloud size={24} />
          <span style={{ fontSize: '12px', fontWeight: '600' }}>GeoJSON, KML, SHP, KMZ</span>
          <input type="file" onChange={handleFileUpload} style={{ fontSize: '11px' }} />
        </div>
      </div>

      {newLote.area_ha > 0 && (
        <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '8px', border: '1px solid var(--primary-border)', fontSize: '11.5px' }}>
          <span>Área: <strong>{newLote.area_ha} ha</strong> | Perímetro: <strong>{newLote.perimetro_m} m</strong></span>
        </div>
      )}

      <div className="form-group-container">
        <div>
          <label className="form-label">Código Interno</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            placeholder="Ej. A3" 
            required 
            value={newLote.codigo_interno} 
            onChange={e => setNewLote(p => ({ ...p, codigo_interno: e.target.value }))} 
          />
        </div>
        <div>
          <label className="form-label">Nombre</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            placeholder="Ej. Lote A3" 
            required 
            value={newLote.nombre} 
            onChange={e => setNewLote(p => ({ ...p, nombre: e.target.value }))} 
          />
        </div>
      </div>

      <div className="form-group-container">
        <div>
          <label className="form-label">Cultivo</label>
          <select 
            className="input-glass select-glass" 
            style={{ width: '100%' }} 
            value={newLote.cultivo} 
            onChange={e => setNewLote(p => ({ ...p, cultivo: e.target.value }))}
          >
            <option value="Maíz">Maíz</option>
            <option value="Soya">Soya</option>
            <option value="Girasol">Girasol</option>
          </select>
        </div>
        <div>
          <label className="form-label">Variedad</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newLote.variedad} 
            onChange={e => setNewLote(p => ({ ...p, variedad: e.target.value }))} 
          />
        </div>
      </div>

      <div className="form-group-container">
        <div>
          <label className="form-label">Fecha Siembra</label>
          <input 
            type="date" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newLote.fecha_siembra} 
            onChange={e => setNewLote(p => ({ ...p, fecha_siembra: e.target.value }))} 
          />
        </div>
        <div>
          <label className="form-label">Responsable Técnico</label>
          <input 
            type="text" 
            className="input-glass" 
            style={{ width: '100%' }} 
            required 
            value={newLote.responsable_tecnico} 
            onChange={e => setNewLote(p => ({ ...p, responsable_tecnico: e.target.value }))} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsLoteDrawerOpen(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, background: 'var(--primary)' }}>Guardar Lote</button>
      </div>
    </form>
  );
}

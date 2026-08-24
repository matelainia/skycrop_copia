import React, { useState, useEffect } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { useLotsContext } from '../../context/LotsContext';
import { agronomyRepository } from '../../repositories/agronomyRepository';

export default function LotForm() {
  const {
    newLote, setNewLote, handleFileUpload, handleAddLote,
    setIsLoteDrawerOpen, logAudit, cultivos, cultivosCargando
  } = useLotsContext();

  const [estadosFenologicos, setEstadosFenologicos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // Cargar estados fenológicos cuando cambia el cultivo (por id o nombre exacto)
  useEffect(() => {
    const cultivoMatch = cultivos.find(
      (c) => c.id === newLote.cultivo_id ||
        (newLote.cultivo && c.nombre.toLowerCase() === newLote.cultivo.toLowerCase())
    );
    if (!cultivoMatch) {
      setEstadosFenologicos([]);
      return;
    }
    agronomyRepository.getEstadosFenologicos(cultivoMatch.id)
      .then(data => setEstadosFenologicos(data))
      .catch(() => setEstadosFenologicos([]));
  }, [newLote.cultivo_id, newLote.cultivo, cultivos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const result = await handleAddLote(logAudit);
      if (result && result.success === false && result.errors) {
        const mensajes = Object.values(result.errors).flat().join('\n');
        alert(`No fue posible guardar el lote:\n${mensajes}`);
      }
    } finally {
      setGuardando(false);
    }
  };

  const close = () => setIsLoteDrawerOpen(false);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '18px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Nuevo Lote</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

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
              {/* Texto libre con sugerencias del catálogo maestro: el usuario escribe
                  el cultivo; si coincide con el catálogo se vincula cultivo_id. */}
              <input
                type="text"
                className="input-glass"
                style={{ width: '100%' }}
                list="cultivos-sugeridos"
                placeholder="Escriba el cultivo (ej. Cacao, Café...)"
                autoComplete="off"
                required
                value={newLote.cultivo || ''}
                onChange={e => {
                  const nombre = e.target.value;
                  const match = cultivos.find(
                    (c) => c.nombre.toLowerCase() === nombre.toLowerCase()
                  );
                  setNewLote(p => ({
                    ...p,
                    cultivo: nombre,
                    cultivo_id: match ? match.id : null
                  }));
                }}
              />
              <datalist id="cultivos-sugeridos">
                {cultivos.map(c => (
                  <option key={c.id} value={c.nombre} />
                ))}
              </datalist>
              {cultivosCargando && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cargando catálogo de cultivos...</span>
              )}
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
              <label className="form-label">Área (ha)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-glass"
                style={{ width: '100%' }}
                placeholder={newLote.coordinates ? 'Definida por el archivo' : 'Ej. 12.5'}
                value={newLote.area_ha || ''}
                onChange={e => {
                  const v = e.target.value;
                  setNewLote(p => ({ ...p, area_ha: v === '' ? '' : parseFloat(v) }));
                }}
              />
              {!newLote.coordinates && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Opcional si no carga archivo espacial.
                </span>
              )}
            </div>
          </div>

          <div className="form-group-container">
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
            <div>
              <label className="form-label">Sistema Productivo</label>
              <input
                type="text"
                className="input-glass"
                style={{ width: '100%' }}
                value={newLote.sistema_productivo || ''}
                onChange={e => setNewLote(p => ({ ...p, sistema_productivo: e.target.value }))}
              />
            </div>
          </div>

          {/* Estado Fenológico dinámico según cultivo */}
          {estadosFenologicos.length > 0 && (
            <div>
              <label className="form-label">Estado Fenológico Actual</label>
              <select
                className="input-glass select-glass"
                style={{ width: '100%' }}
                value={newLote['estado_fenológico'] || ''}
                onChange={e => setNewLote(p => ({ ...p, 'estado_fenológico': e.target.value, estado_fenologico: e.target.value }))}
              >
                <option value="">Seleccione una etapa...</option>
                {estadosFenologicos.map(ef => (
                  <option key={ef.id} value={ef.nombre}>{ef.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={close} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, background: 'var(--primary)' }} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar Lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

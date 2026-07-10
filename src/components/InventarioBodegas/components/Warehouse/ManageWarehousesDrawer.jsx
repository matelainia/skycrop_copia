import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { getResponsableName } from '../../utils/inventoryHelpers';
import { DEFAULT_NEW_WAREHOUSE } from '../../utils/inventoryConstants';

export default function ManageWarehousesDrawer({
  isOpen,
  onClose,
  warehouses = [],
  workers = [],
  onCreateWarehouse,
  onDeleteWarehouse
}) {
  const [newWh, setNewWh] = useState(DEFAULT_NEW_WAREHOUSE);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const created = await onCreateWarehouse(newWh);
    if (created) {
      setNewWh(DEFAULT_NEW_WAREHOUSE);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" style={{ width: '550px' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Gestionar Bodegas</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* List of Warehouses */}
        <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Bodegas Registradas
          </h4>
          {warehouses.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay bodegas registradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
              {warehouses.map(w => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{w.nombre}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {w.sector} | <span style={{ color: 'var(--primary)' }}>{w.categoria}</span> {w.coordenadaX && w.coordenadaY && ` | (${w.coordenadaX}, ${w.coordenadaY})`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Responsable: <strong>{getResponsableName(w.responsableId, workers)}</strong>
                    </div>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => onDeleteWarehouse(w.id)}
                    style={{ padding: '8px', borderRadius: '8px' }}
                    title="Eliminar Bodega"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Warehouse Form */}
        <div>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Agregar Nueva Bodega
          </h4>
          <form className="drawer-form" onSubmit={handleSubmit}>
            <div>
              <label className="form-label">Nombre de la Bodega</label>
              <input
                type="text"
                className="input-glass"
                style={{ width: '100%' }}
                placeholder="Ej. Bodega Central"
                required
                value={newWh.nombre}
                onChange={e => setNewWh(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div>
              <label className="form-label">Sector o Área</label>
              <input
                type="text"
                className="input-glass"
                style={{ width: '100%' }}
                placeholder="Ej. Sector A (Semillas y Abonos)"
                required
                value={newWh.sector}
                onChange={e => setNewWh(prev => ({ ...prev, sector: e.target.value }))}
              />
            </div>

            <div className="form-group-container">
              <div>
                <label className="form-label">Coordenada X (Latitud)</label>
                <input
                  type="number"
                  step="any"
                  className="input-glass"
                  style={{ width: '100%' }}
                  placeholder="Ej. 3.4516"
                  required
                  value={newWh.coordenadaX}
                  onChange={e => setNewWh(prev => ({ ...prev, coordenadaX: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Coordenada Y (Longitud)</label>
                <input
                  type="number"
                  step="any"
                  className="input-glass"
                  style={{ width: '100%' }}
                  placeholder="Ej. -76.5320"
                  required
                  value={newWh.coordenadaY}
                  onChange={e => setNewWh(prev => ({ ...prev, coordenadaY: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Categoría</label>
              <select
                className="input-glass select-glass"
                style={{ width: '100%' }}
                value={newWh.categoria}
                onChange={e => setNewWh(prev => ({ ...prev, categoria: e.target.value }))}
              >
                <option value="Agroquímicos">Agroquímicos</option>
                <option value="Fertilizantes">Fertilizantes</option>
                <option value="Herramientas">Herramientas</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {newWh.categoria === 'Otro' && (
              <div>
                <label className="form-label">Especificar Categoría</label>
                <input
                  type="text"
                  className="input-glass"
                  style={{ width: '100%' }}
                  placeholder="Ej. Empaques, Riego, etc."
                  required
                  value={newWh.categoriaOtro}
                  onChange={e => setNewWh(prev => ({ ...prev, categoriaOtro: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="form-label">Responsable de la Bodega</label>
              <select
                className="input-glass select-glass"
                style={{ width: '100%' }}
                value={newWh.responsableId}
                onChange={e => setNewWh(prev => ({ ...prev, responsableId: e.target.value }))}
              >
                <option value="">Sin responsable asignado</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.nombres} {w.apellidos}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
                Cerrar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                Guardar Bodega
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

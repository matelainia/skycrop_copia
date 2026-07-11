import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_NEW_ITEM, CATEGORIES } from '../../utils/inventoryConstants';
import WarehouseSelector from '../Shared/WarehouseSelector';

export default function AddItemDrawer({
  isOpen,
  onClose,
  warehouses = [],
  onAddItem
}) {
  const [newItem, setNewItem] = useState(DEFAULT_NEW_ITEM);

  // Set default warehouseId when warehouses load or change
  useEffect(() => {
    if (warehouses.length > 0 && !newItem.warehouseId) {
      setNewItem(prev => ({ ...prev, warehouseId: warehouses[0].id }));
    }
  }, [warehouses, newItem.warehouseId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const created = await onAddItem(newItem);
    if (created) {
      setNewItem({
        ...DEFAULT_NEW_ITEM,
        warehouseId: warehouses[0]?.id || ''
      });
      onClose();
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Agregar Insumo al Inventario</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form className="drawer-form" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Nombre del Artículo / Insumo</label>
            <input
              type="text"
              className="input-glass"
              style={{ width: '100%' }}
              placeholder="Ej. Abono Orgánico Bocashi"
              required
              value={newItem.name}
              onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="form-group-container">
            <div>
              <label className="form-label">Categoría</label>
              <select
                className="input-glass select-glass"
                style={{ width: '100%' }}
                value={newItem.category}
                onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value }))}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Unidad de Medida</label>
              <select
                className="input-glass select-glass"
                style={{ width: '100%' }}
                value={newItem.unit}
                onChange={e => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="L">Litros (L)</option>
                <option value="unidades">Unidades</option>
                <option value="sacos">Sacos</option>
              </select>
            </div>
          </div>

          <div className="form-group-container">
            <div>
              <label className="form-label">Stock Inicial</label>
              <input
                type="number"
                min="0"
                className="input-glass"
                style={{ width: '100%' }}
                placeholder="Ej. 100"
                required
                value={newItem.quantity}
                onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Mínimo de Alerta (Stock Crítico)</label>
              <input
                type="number"
                min="0"
                className="input-glass"
                style={{ width: '100%' }}
                placeholder="Ej. 20"
                required
                value={newItem.minQuantity}
                onChange={e => setNewItem(prev => ({ ...prev, minQuantity: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group-container">
            <div>
              <label className="form-label">Número de Lote</label>
              <input
                type="text"
                className="input-glass"
                style={{ width: '100%' }}
                placeholder="Ej. LT-1092"
                value={newItem.lote}
                onChange={e => setNewItem(prev => ({ ...prev, lote: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Registro ICA</label>
              <input
                type="text"
                className="input-glass"
                style={{ width: '100%' }}
                placeholder="Ej. ICA-1029-F"
                value={newItem.registroIca}
                onChange={e => setNewItem(prev => ({ ...prev, registroIca: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Comentarios</label>
            <textarea
              className="input-glass"
              style={{ width: '100%', height: '80px', resize: 'vertical' }}
              placeholder="Ej. Mantener en un ambiente seco y protegido de la luz solar..."
              value={newItem.comentarios}
              onChange={e => setNewItem(prev => ({ ...prev, comentarios: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">Bodega de Almacenamiento</label>
            {warehouses.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--accent-red)', padding: '10px', background: 'var(--accent-red-light)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                No hay bodegas registradas. Por favor, agregue una bodega primero usando el botón "Gestionar Bodegas".
              </div>
            ) : (
              <WarehouseSelector
                value={newItem.warehouseId}
                onChange={e => setNewItem(prev => ({ ...prev, warehouseId: e.target.value }))}
                warehouses={warehouses}
                required
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={warehouses.length === 0}>
              Registrar Insumo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

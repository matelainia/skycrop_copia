import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_NEW_ITEM, CATEGORIES } from '../../utils/inventoryConstants';
import WarehouseSelector from '../Shared/WarehouseSelector';

// Modal agregar/editar (contrato-v2 §2). En edición el stock es de solo
// lectura: solo cambia vía movimientos (RPC), nunca por UPDATE directo.
export default function ItemModal({
  isOpen,
  onClose,
  warehouses = [],
  initialItem = null,
  onSave
}) {
  const isEdit = !!initialItem;
  const [form, setForm] = useState(DEFAULT_NEW_ITEM);

  useEffect(() => {
    if (!isOpen) return;
    if (initialItem) {
      setForm({
        name: initialItem.name || '',
        category: initialItem.category || CATEGORIES[0],
        sku: initialItem.sku || '',
        quantity: initialItem.quantity ?? '',
        unit: initialItem.unit || 'kg',
        minQuantity: initialItem.minQuantity ?? '',
        maxQuantity: initialItem.maxQuantity ?? '',
        warehouseId: initialItem.warehouseId || '',
        lote: initialItem.lote || '',
        registroIca: initialItem.registroIca || '',
        comentarios: initialItem.comentarios || ''
      });
    } else {
      setForm({ ...DEFAULT_NEW_ITEM, warehouseId: warehouses[0]?.id || '' });
    }
  }, [isOpen, initialItem, warehouses]);

  // Autoseleccionar bodega cuando cargan (solo alta).
  useEffect(() => {
    if (isOpen && !isEdit && warehouses.length > 0 && !form.warehouseId) {
      setForm((prev) => ({ ...prev, warehouseId: warehouses[0].id }));
    }
  }, [isOpen, isEdit, warehouses, form.warehouseId]);

  if (!isOpen) return null;

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const saved = await onSave(form, isEdit ? initialItem.id : null);
    if (saved) onClose();
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>{isEdit ? 'Editar Insumo' : 'Agregar Insumo al Inventario'}</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form className="drawer-form" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Nombre del Artículo / Insumo *</label>
            <input
              type="text" className="input-glass" style={{ width: '100%' }}
              placeholder="Ej. Urea granulada 46-0-0" required autoFocus
              value={form.name} onChange={set('name')}
            />
          </div>

          <div className="form-group-container">
            <div>
              <label className="form-label">Categoría</label>
              <select className="input-glass select-glass" style={{ width: '100%' }} value={form.category} onChange={set('category')}>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">SKU / Código {!isEdit && '(opcional, se genera solo)'}</label>
              <input
                type="text" className="input-glass" style={{ width: '100%' }}
                placeholder="Ej. FER-0011" value={form.sku} onChange={set('sku')}
              />
            </div>
          </div>

          <div className="form-group-container">
            <div>
              <label className="form-label">Unidad de Medida</label>
              <select className="input-glass select-glass" style={{ width: '100%' }} value={form.unit} onChange={set('unit')}>
                <option value="kg">Kilogramos (kg)</option>
                <option value="L">Litros (L)</option>
                <option value="unidades">Unidades</option>
                <option value="sacos">Sacos</option>
              </select>
            </div>
            <div>
              <label className="form-label">Bodega de Almacenamiento *</label>
              {warehouses.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--accent-red)', padding: '10px', background: 'var(--accent-red-light)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  No hay bodegas registradas. Agregue una con "Gestionar Bodegas".
                </div>
              ) : (
                <WarehouseSelector value={form.warehouseId} onChange={set('warehouseId')} warehouses={warehouses} required />
              )}
            </div>
          </div>

          <div className="form-group-container">
            <div>
              <label className="form-label">Stock {isEdit ? '(solo lectura: usa movimientos)' : 'Inicial *'}</label>
              <input
                type="number" min="0" className="input-glass" style={{ width: '100%' }}
                placeholder="Ej. 100" required={!isEdit} disabled={isEdit}
                value={form.quantity} onChange={set('quantity')}
              />
            </div>
            <div>
              <label className="form-label">Mínimo de Alerta *</label>
              <input
                type="number" min="0" className="input-glass" style={{ width: '100%' }}
                placeholder="Ej. 20" required
                value={form.minQuantity} onChange={set('minQuantity')}
              />
            </div>
          </div>

          <div className="form-group-container">
            <div>
              <label className="form-label">Máximo (sobrestock, opcional)</label>
              <input
                type="number" min="0" className="input-glass" style={{ width: '100%' }}
                placeholder="Ej. 600" value={form.maxQuantity} onChange={set('maxQuantity')}
              />
            </div>
            <div>
              <label className="form-label">Número de Lote</label>
              <input
                type="text" className="input-glass" style={{ width: '100%' }}
                placeholder="Ej. LT-1092" value={form.lote} onChange={set('lote')}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Registro ICA</label>
            <input
              type="text" className="input-glass" style={{ width: '100%' }}
              placeholder="Ej. ICA-1029-F" value={form.registroIca} onChange={set('registroIca')}
            />
          </div>

          <div>
            <label className="form-label">Comentarios</label>
            <textarea
              className="input-glass" style={{ width: '100%', height: '80px', resize: 'vertical' }}
              placeholder="Ej. Mantener en ambiente seco…" value={form.comentarios} onChange={set('comentarios')}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={warehouses.length === 0}>
              {isEdit ? 'Guardar Cambios' : 'Registrar Insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

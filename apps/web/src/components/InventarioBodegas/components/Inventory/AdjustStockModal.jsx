import React, { useState } from 'react';
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function AdjustStockModal({
  isOpen,
  onClose,
  item,
  onAdjust
}) {
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'sub'
  const [reason, setReason] = useState('');

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (adjustAmount === '') return;

    const typeMapped = adjustType === 'add' ? 'entrada' : 'salida';
    const amount = Number(adjustAmount);

    const success = await onAdjust(item.id, amount, typeMapped, reason, item.warehouseId);
    if (success) {
      setAdjustAmount('');
      setReason('');
      onClose();
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Ajustar Inventario</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Artículo Seleccionado:</span>
          <h4 style={{ fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{item.name}</h4>
          <p style={{ fontSize: '14px', marginTop: '6px' }}>Stock actual: <strong style={{ color: 'var(--primary)' }}>{item.quantity} {item.unit}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="drawer-form">
          <div>
            <label className="form-label">Tipo de Movimiento</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${adjustType === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAdjustType('add')}
                style={{ justifyContent: 'center' }}
              >
                <ArrowUpRight size={16} />
                Entrada / Carga
              </button>
              <button
                type="button"
                className={`btn ${adjustType === 'sub' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setAdjustType('sub')}
                style={{ justifyContent: 'center' }}
              >
                <ArrowDownRight size={16} />
                Salida / Despacho
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">Cantidad a modificar ({item.unit})</label>
            <input
              type="number"
              min="1"
              className="input-glass"
              style={{ width: '100%' }}
              placeholder="Ej. 50"
              required
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Motivo o Comentario del Ajuste</label>
            <input
              type="text"
              className="input-glass"
              style={{ width: '100%' }}
              placeholder="Ej. Reabastecimiento de lote, merma, etc."
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
              Confirmar Ajuste
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

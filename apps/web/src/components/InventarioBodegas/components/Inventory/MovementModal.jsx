import React, { useState, useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Scale, ArrowLeftRight } from 'lucide-react';

const TYPES = [
  { id: 'entrada', label: 'Entrada', icon: ArrowUpRight },
  { id: 'salida', label: 'Salida', icon: ArrowDownRight },
  { id: 'ajuste', label: 'Ajuste', icon: Scale },
  { id: 'transferencia', label: 'Transfer.', icon: ArrowLeftRight },
];

// Modal de movimiento (contrato-v2 §2). El preview es solo UX: la verdad la
// dicta la RPC ([CONFLICT] se muestra como conflicto, no error genérico).
export default function MovementModal({
  isOpen,
  onClose,
  item,
  warehouses = [],
  onAdjust,   // (itemId, quantity, type, reason, warehouseId)
  onTransfer, // (itemId, quantity, destWarehouseId, reason)
}) {
  const [movType, setMovType] = useState('entrada');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');

  const destOptions = useMemo(
    () => warehouses.filter((w) => w.id !== item?.warehouseId),
    [warehouses, item]
  );

  if (!isOpen || !item) return null;

  const qty = Number(amount);
  const qtyValid = amount !== '' && !Number.isNaN(qty) && qty > 0;
  const destValid = movType !== 'transferencia' || (destWarehouseId && destWarehouseId !== item.warehouseId);
  const canSubmit = qtyValid && destValid && reason.trim() !== '';

  const preview = () => {
    if (!qtyValid) return 'Ingresa una cantidad válida para ver el resultado.';
    if (movType === 'entrada') return `Stock resultante: ${item.quantity + qty} ${item.unit}`;
    if (movType === 'salida') {
      const rest = item.quantity - qty;
      return rest < 0
        ? `⚠️ La salida supera el stock (${item.quantity}). El backend la rechazará como conflicto.`
        : `Stock resultante: ${rest} ${item.unit}`;
    }
    if (movType === 'ajuste') {
      const delta = qty - item.quantity;
      return `Conteo físico: ${qty} ${item.unit} (diferencia ${delta >= 0 ? '+' : ''}${delta})`;
    }
    const dest = warehouses.find((w) => w.id === destWarehouseId);
    return `Traslado de ${qty} ${item.unit} → ${dest ? dest.nombre : '…'}`;
  };

  const resetAndClose = () => {
    setMovType('entrada');
    setAmount('');
    setReason('');
    setDestWarehouseId('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    let ok = false;
    if (movType === 'transferencia') {
      ok = !!(await onTransfer(item.id, qty, destWarehouseId, reason.trim()));
    } else {
      ok = !!(await onAdjust(item.id, qty, movType, reason.trim(), item.warehouseId));
    }
    if (ok) resetAndClose();
    // Si la RPC falla (incluido [CONFLICT]), el toast ya lo informó y el
    // modal queda abierto con los datos para corregir y reintentar.
  };

  return (
    <div className="drawer-backdrop" onClick={resetAndClose}>
      <div className="drawer-content" style={{ width: '440px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>Registrar movimiento</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {item.name} · stock {item.quantity} {item.unit}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={resetAndClose} style={{ padding: '6px' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="drawer-form">
          <div>
            <label className="form-label">Tipo de Movimiento</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }} role="tablist" aria-label="Tipo de movimiento">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const active = movType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setMovType(t.id)}
                    style={{ justifyContent: 'center', flexDirection: 'column', gap: '4px', padding: '8px 4px', fontSize: '12px' }}
                  >
                    <Icon size={16} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {movType === 'transferencia' ? (
            <div>
              <label className="form-label">Cantidad a trasladar ({item.unit})</label>
              <input
                type="number" min="1" className="input-glass" style={{ width: '100%' }}
                placeholder="Ej. 20" required value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="form-label">
                {movType === 'ajuste' ? `Nuevo conteo físico (${item.unit})` : `Cantidad (${item.unit})`}
              </label>
              <input
                type="number" min={movType === 'ajuste' ? '0' : '1'} className="input-glass" style={{ width: '100%' }}
                placeholder={movType === 'ajuste' ? 'Ej. 42' : 'Ej. 50'} required value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}

          {movType === 'transferencia' && (
            <div>
              <label className="form-label">Bodega destino</label>
              <select
                className="input-glass select-glass" style={{ width: '100%' }} required
                value={destWarehouseId} onChange={(e) => setDestWarehouseId(e.target.value)}
              >
                <option value="">Seleccionar destino…</option>
                {destOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.nombre} ({w.sector})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="form-label">Motivo / documento</label>
            <input
              type="text" className="input-glass" style={{ width: '100%' }}
              placeholder="Orden de compra, lote de aplicación, conteo…" required
              value={reason} onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '10px', padding: '10px 12px' }}>
            {preview()}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={resetAndClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={!canSubmit}>
              Confirmar movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

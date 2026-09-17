import React from 'react';
import { X } from 'lucide-react';

// ConfirmDialog reutilizable (eliminar artículo, cerrar sesión, etc.).
// Reemplaza window.confirm: foco inicial en Cancelar (acción segura).
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Confirmar acción?',
  message = '',
  confirmLabel = 'Eliminar',
  danger = true
}) {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer-content"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: '400px', height: 'auto', alignSelf: 'center', borderRadius: '16px', margin: 'auto', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="drawer-header" style={{ justifyContent: 'center' }}>
          <h3>{title}</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px', position: 'absolute', right: '16px' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {message && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '12px 0 4px' }}>{message}</p>
        )}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={onClose} autoFocus>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            style={{ flexGrow: 1 }}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

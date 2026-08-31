import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical, Eye, Pencil, ClipboardPlus, Link2, Trash2 } from 'lucide-react';

/**
 * ApplicationActions — ⋮ dropdown con acciones condicionales reales.
 * Solo muestra acciones soportadas; no botones de demostración.
 */
const ApplicationActions = memo(function ApplicationActions({ aplicacion, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const handle = useCallback((key) => {
    setOpen(false);
    onAction?.(key, aplicacion);
  }, [onAction, aplicacion]);

  return (
    <div className="actions-dropdown" ref={ref}>
      <button
        className="fert-btn fert-btn--ghost fert-btn--icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Acciones de la aplicación del ${aplicacion.fechaFormatted}`}
        aria-haspopup="true"
        aria-expanded={open}
        id={`app-actions-${aplicacion.id}`}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="actions-dropdown__menu" role="menu" aria-labelledby={`app-actions-${aplicacion.id}`}>
          <button role="menuitem" className="actions-dropdown__item" onClick={() => handle('view')}>
            <Eye size={14} aria-hidden="true" /> Ver detalle
          </button>
          <button role="menuitem" className="actions-dropdown__item" onClick={() => handle('edit')}>
            <Pencil size={14} aria-hidden="true" /> Editar
          </button>
          <button role="menuitem" className="actions-dropdown__item" onClick={() => handle('register')}>
            <ClipboardPlus size={14} aria-hidden="true" /> Registrar aplicación
          </button>
          <button role="menuitem" className="actions-dropdown__item" onClick={() => handle('recommendation')}>
            <Link2 size={14} aria-hidden="true" /> Ver recomendación
          </button>
          <div className="actions-dropdown__separator" role="separator" />
          <button role="menuitem" className="actions-dropdown__item actions-dropdown__item--danger" onClick={() => handle('delete')}>
            <Trash2 size={14} aria-hidden="true" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
});

export default ApplicationActions;

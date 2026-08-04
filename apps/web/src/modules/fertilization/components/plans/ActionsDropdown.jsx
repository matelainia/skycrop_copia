/**
 * ActionsDropdown.jsx  ·  components/plans/
 * Menú contextual de 11 acciones para un plan de fertilización.
 *
 * Abre/cierra al click en el botón MoreVertical.
 * Se cierra también al hacer clic fuera del menú (useEffect + document listener).
 *
 * @param {object} plan - Plan sobre el que actúan las acciones
 * @param {object} handlers - Callbacks { onView, onEdit, onDuplicate, onScheduleApps,
 *                            onGenerateRecs, onExportPdf, onExportExcel,
 *                            onViewHistory, onArchive, onDelete }
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye,
  Pencil,
  Copy,
  CalendarDays,
  Lightbulb,
  FileDown,
  FileSpreadsheet,
  History,
  Archive,
  Trash2,
  MoreVertical,
  Sprout,
} from 'lucide-react';

const MENU_ITEMS = [
  { key: 'view',          label: 'Ver Detalle',            icon: Eye,             handler: 'onView',          variant: '' },
  { key: 'edit',          label: 'Editar Plan',            icon: Pencil,          handler: 'onEdit',          variant: '' },
  { key: 'duplicate',     label: 'Duplicar / Nueva Versión',icon: Copy,           handler: 'onDuplicate',     variant: '' },
  { key: 'sep1', type: 'separator' },
  { key: 'schedule',      label: 'Programar Aplicaciones', icon: CalendarDays,    handler: 'onScheduleApps',  variant: '' },
  { key: 'recommendations',label: 'Generar Recomendaciones',icon: Lightbulb,      handler: 'onGenerateRecs',  variant: '' },
  { key: 'sep2', type: 'separator' },
  { key: 'exportPdf',     label: 'Exportar PDF',           icon: FileDown,        handler: 'onExportPdf',     variant: '' },
  { key: 'exportExcel',   label: 'Exportar Excel',         icon: FileSpreadsheet, handler: 'onExportExcel',   variant: '' },
  { key: 'history',       label: 'Historial & Versiones',  icon: History,         handler: 'onViewHistory',   variant: '' },
  { key: 'sep3', type: 'separator' },
  { key: 'archive',       label: 'Archivar',               icon: Archive,         handler: 'onArchive',       variant: '' },
  { key: 'delete',        label: 'Eliminar',               icon: Trash2,          handler: 'onDelete',        variant: 'dropdown-item--danger' },
];

const ActionsDropdown = React.memo(function ActionsDropdown({ plan, handlers = {} }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Cierra al clic fuera
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Cierra con Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleItemClick = useCallback(
    (handlerKey) => {
      setOpen(false);
      handlers[handlerKey]?.(plan);
    },
    [handlers, plan],
  );

  return (
    <div className="actions-dropdown" ref={menuRef}>
      <button
        className="fert-btn fert-btn--ghost fert-btn--icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Más acciones para ${plan.name}`}
        aria-haspopup="true"
        aria-expanded={open}
        id={`actions-btn-${plan.id}`}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="actions-dropdown__menu"
          role="menu"
          aria-labelledby={`actions-btn-${plan.id}`}
        >
          {MENU_ITEMS.map((item) => {
            if (item.type === 'separator') {
              return <div key={item.key} className="actions-dropdown__separator" role="separator" />;
            }
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                role="menuitem"
                className={`actions-dropdown__item ${item.variant}`}
                onClick={() => handleItemClick(item.handler)}
              >
                <Icon size={14} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default ActionsDropdown;

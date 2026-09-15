import { useRef } from 'react';
import { MACHINERY_TABS } from '../constants/machineryTabs';

/**
 * MachineryTabs — navegación por pestañas dentro del módulo.
 * Una única aplicación: las pestañas comparten contexto, filtros y caché.
 *
 * Accesibilidad: role=tablist/tab, aria-selected, navegación con flechas,
 * focus visible. Respeta prefers-reduced-motion vía CSS.
 */
export function MachineryTabs({ activeTab, onChange, alertCount = 0 }) {
  const listRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = MACHINERY_TABS.findIndex((t) => t.id === activeTab);
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = MACHINERY_TABS[(idx + dir + MACHINERY_TABS.length) % MACHINERY_TABS.length];
    onChange(next.id);
    // Mover foco al nuevo tab
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-tab="${next.id}"]`)?.focus();
    });
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Secciones del módulo Maquinaria"
      className="machinery-tabs no-scrollbar"
      onKeyDown={handleKeyDown}
    >
      {MACHINERY_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab={tab.id}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`machinery-tab${isActive ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.id === 'alertas' && alertCount > 0 && (
              <span className="machinery-tab-badge" aria-label={`${alertCount} alertas activas`}>
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default MachineryTabs;

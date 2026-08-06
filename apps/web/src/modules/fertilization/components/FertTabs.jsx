import { memo } from 'react';
import { motion } from 'framer-motion';

import {
  LayoutDashboard,
  Sprout,
  ListChecks,
  FlaskConical,
  Microscope,
  History,
} from 'lucide-react';

const TABS = [
  { id: 'resumen',          label: 'Resumen',                   icon: LayoutDashboard },
  { id: 'planes',           label: 'Planes de Fertilización',   icon: Sprout },
  { id: 'recomendaciones',  label: 'Recomendaciones',           icon: ListChecks },
  { id: 'aplicaciones',     label: 'Aplicaciones',              icon: FlaskConical },
  { id: 'analisis-suelos',  label: 'Análisis de Suelos',        icon: Microscope },
  { id: 'historial',        label: 'Historial',                 icon: History },
];

/**
 * FertTabs
 * Tab navigation bar with Framer Motion animated underline indicator.
 * Active tab: green text + 2px green bottom border (layoutId animated).
 *
 * Keyboard accessible: arrow keys navigate between tabs.
 *
 * @param {string}   activeTab   - currently active tab id
 * @param {function} onTabChange - called with the new tab id
 */
function FertTabs({ activeTab = 'resumen', onTabChange }) {
  const handleKeyDown = (e, _tabId, index) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const newIndex = e.key === 'ArrowRight'
      ? Math.min(index + 1, TABS.length - 1)
      : Math.max(index - 1, 0);
    onTabChange?.(TABS[newIndex].id);

    // Move focus to the newly active tab button
    const buttons = e.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]');
    buttons[newIndex]?.focus();
  };

  return (
    <div
      className="fert-tabs"
      role="tablist"
      aria-label="Secciones del módulo de Fertilización"
    >
      {TABS.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            id={`fert-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`fert-tabpanel-${tab.id}`}
            className={`fert-tab-btn ${isActive ? 'fert-tab-btn--active' : ''}`}
            onClick={() => onTabChange?.(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id, index)}
            tabIndex={isActive ? 0 : -1}
          >
            <Icon size={15} aria-hidden="true" />
            {tab.label}

            {/* Animated underline — shared layoutId causes it to slide between tabs */}
            {isActive && (
              <motion.div
                className="fert-tab-indicator"
                layoutId="fert-active-tab-indicator"
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default memo(FertTabs);


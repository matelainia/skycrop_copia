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

function FertTabs({ activeTab = 'resumen', onTabChange }) {
  return (
    <div
      className="fert-tabs"
      role="tablist"
      aria-label="Secciones del módulo de Fertilización"
      style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-color, #E5E7EB)',
        paddingBottom: '2px',
        overflowX: 'auto',
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`fert-tab-btn ${isActive ? 'fert-tab-btn--active' : ''}`}
            onClick={() => onTabChange?.(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: isActive ? '600' : '500',
              color: isActive ? '#059669' : '#4B5563',
              background: 'transparent',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={16} />
            <span>{tab.label}</span>

            {isActive && (
              <motion.div
                className="fert-tab-indicator"
                layoutId="fert-active-tab-indicator"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#059669',
                }}
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

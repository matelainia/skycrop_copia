import React from 'react';
import { Package, Layers, ArrowLeftRight } from 'lucide-react';

const TABS = [
  { id: 'insumos', label: 'Insumos', icon: Package },
  { id: 'bodegas', label: 'Bodegas', icon: Layers },
  { id: 'movs', label: 'Movimientos', icon: ArrowLeftRight },
];

export default function WorkspaceTabs({ activeTab, onChange, counts = {} }) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }} role="tablist" aria-label="Vistas de inventario">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', fontSize: '13px', fontWeight: '700',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            <Icon size={15} />
            {t.label}
            {counts[t.id] !== undefined && (
              <span style={{ fontSize: '11px', background: active ? 'var(--primary-light)' : 'var(--border-color)', color: active ? 'var(--primary)' : 'var(--text-muted)', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>
                {counts[t.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

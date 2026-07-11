import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ESTADOS_UI_CONFIG } from '../../../../constants/aplicaciones';

export default function EstadoChipDropdown({ estadoKey, estadoCfg, permitidos, onSelect }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(p => !p)}
        title="Cambiar estado"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: '11.5px', fontWeight: '600', padding: '4px 10px 4px 9px', borderRadius: '50px',
          background: estadoCfg.bg, color: estadoCfg.color,
          border: `1px solid ${estadoCfg.border}`,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.15s', outline: 'none',
          boxShadow: open ? `0 0 0 2px ${estadoCfg.border}` : 'none'
        }}
      >
        {estadoCfg.emoji} {estadoCfg.label} <ChevronDown size={10} style={{ opacity: 0.7, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <>
          {/* Overlay to close when clicking outside */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setOpen(false)} />

          {/* Options Dropdown */}
          <div style={{
            position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 300,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.22)',
            padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px',
            minWidth: '170px'
          }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px 6px' }}>
              Cambiar a:
            </div>
            {permitidos.map(pKey => {
              const pCfg = ESTADOS_UI_CONFIG[pKey];
              if (!pCfg) return null;
              return (
                <button key={pKey}
                  onClick={() => { setOpen(false); onSelect(pKey); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 10px', borderRadius: '7px', border: 'none',
                    background: 'transparent', cursor: 'pointer', fontSize: '12.5px',
                    color: 'var(--text-primary)', fontFamily: 'inherit',
                    transition: 'background 0.1s', textAlign: 'left'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = pCfg.bg; e.currentTarget.style.color = pCfg.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                  <span style={{ fontSize: '13px' }}>{pCfg.emoji}</span>
                  <span style={{ fontWeight: '600' }}>{pCfg.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

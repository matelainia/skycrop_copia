import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { getStockStatus, isAlertStatus, getStatusMeta } from '../../utils/inventoryStatus';

// Campana de alertas de reposición (crítico + agotado). El popover permite
// saltar al filtro "Con alerta" sin perder el contexto (contrato §5).
export default function StockAlertsBell({ items = [], onFilterAlerts }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const alerts = items.filter((it) => isAlertStatus(getStockStatus(it)));

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen((v) => !v)}
        title="Alertas de reposición"
        aria-label={`Alertas de reposición (${alerts.length})`}
        aria-expanded={open}
        style={{ padding: '6px 10px', position: 'relative' }}
      >
        <Bell size={18} />
        {alerts.length > 0 && (
          <span
            style={{
              position: 'absolute', top: '-6px', right: '-6px',
              minWidth: '18px', height: '18px', borderRadius: '9px',
              background: 'var(--accent-red, #dc2626)', color: '#fff',
              fontSize: '11px', fontWeight: '700',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
            }}
          >
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Alertas de reposición"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50,
            width: '320px', maxHeight: '360px', overflowY: 'auto',
            background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)',
            borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: '12px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Alertas de reposición
          </div>
          {alerts.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sin alertas activas. 🎉</p>
          ) : (
            alerts.slice(0, 20).map((it) => {
              const st = getStockStatus(it);
              const meta = getStatusMeta(st);
              return (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stock {it.quantity} · mín. {it.minQuantity}</div>
                  </div>
                  <span className="badge" style={{ background: meta.bg, color: meta.color, flexShrink: 0 }}>{meta.label}</span>
                </div>
              );
            })
          )}
          {alerts.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              onClick={() => { setOpen(false); onFilterAlerts && onFilterAlerts(); }}
            >
              Filtrar artículos con alerta
            </button>
          )}
        </div>
      )}
    </div>
  );
}

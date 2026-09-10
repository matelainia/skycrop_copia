import React from 'react';

/**
 * IntegrityBadge — estado visual de verificación del evento.
 * 🟢 VALIDADO · 🟡 PENDIENTE_SYNC · 🔴 COMPROMETIDO
 */
export function IntegrityBadge({ status, hash, compact = false }) {
  const map = {
    VALIDADO: { dot: '#2e7d32', bg: '#e8f5e9', label: 'Verificado', icon: '✔' },
    PENDIENTE_SYNC: { dot: '#f9a825', bg: '#fff8e1', label: 'Sincronizando', icon: '◷' },
    COMPROMETIDO: { dot: '#c62828', bg: '#ffebee', label: 'Integridad comprometida', icon: '⚠' }
  };
  const m = map[status] || map.PENDIENTE_SYNC;
  return (
    <span
      title={hash ? `Hash ${hash}` : m.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: m.bg, color: m.dot, borderRadius: 999,
        padding: compact ? '2px 8px' : '4px 10px',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.dot, display: 'inline-block' }} />
      {m.icon} {m.label}
    </span>
  );
}

export default IntegrityBadge;

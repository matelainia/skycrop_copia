import React from 'react';
import { getStatusMeta } from '../../utils/inventoryStatus';

// Badge de 5 estados derivados. Mantiene compat con {isLow} (bajo/opt).
export default function ItemStatusBadge({ isLow, status, type = 'text' }) {
  const st = status || (isLow ? 'bajo' : 'opt');
  const meta = getStatusMeta(st);

  if (type === 'badge') {
    return (
      <span className="badge" style={{ background: meta.bg, color: meta.color }}>
        {meta.label}
      </span>
    );
  }

  return (
    <span style={{ fontWeight: '600', color: meta.color }}>
      {meta.label}
    </span>
  );
}

import React from 'react';

export default function ItemStatusBadge({ isLow, type = 'text' }) {
  if (type === 'badge') {
    return (
      <span className={`badge ${isLow ? 'badge-red' : 'badge-green'}`}>
        {isLow ? 'Bajo Stock' : 'Stock Óptimo'}
      </span>
    );
  }

  return (
    <span style={{ fontWeight: '600', color: isLow ? '#d97706' : '#16a34a' }}>
      {isLow ? 'Bajo Stock' : 'Stock Óptimo'}
    </span>
  );
}

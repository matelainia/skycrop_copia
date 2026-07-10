import React from 'react';

export default function WarehouseSelector({
  value,
  onChange,
  warehouses = [],
  required = false,
  placeholder = "Seleccione una bodega...",
  className = "input-glass select-glass",
  style
}) {
  return (
    <select
      className={className}
      style={{ width: '100%', ...style }}
      value={value}
      onChange={onChange}
      required={required}
    >
      <option value="">{placeholder}</option>
      {warehouses.map(w => (
        <option key={w.id} value={w.id}>
          {w.nombre} ({w.sector})
        </option>
      ))}
    </select>
  );
}

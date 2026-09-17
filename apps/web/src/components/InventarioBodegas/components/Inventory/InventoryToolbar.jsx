import React from 'react';
import { Search, X, Download } from 'lucide-react';
import { CATEGORIES } from '../../utils/inventoryConstants';

export const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos los Estados' },
  { value: 'alertas', label: 'Con alerta' },
  { value: 'opt', label: 'Óptimo' },
  { value: 'bajo', label: 'Bajo' },
  { value: 'crit', label: 'Crítico' },
  { value: 'agot', label: 'Agotado' },
  { value: 'sobre', label: 'Sobrestock' },
];

export default function InventoryToolbar({
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  warehouseFilter = 'all',
  setWarehouseFilter,
  warehouses = [],
  statusFilter = 'todos',
  setStatusFilter,
  hasActiveFilters = false,
  onClearFilters,
  onExport
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
      <div style={{ position: 'relative', flexGrow: 1, minWidth: '200px' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar insumos por nombre o SKU…"
          aria-label="Buscar insumos por nombre o SKU"
          className="input-glass"
          style={{ width: '100%', paddingLeft: '40px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <select
        className="input-glass select-glass"
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        aria-label="Filtrar por categoría"
        style={{ minWidth: '170px' }}
      >
        <option value="Todos">Todas las Categorías</option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {setWarehouseFilter && (
        <select
          className="input-glass select-glass"
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          aria-label="Filtrar por bodega"
          style={{ minWidth: '170px' }}
        >
          <option value="all">Todas las Bodegas</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.nombre}</option>
          ))}
        </select>
      )}

      {setStatusFilter && (
        <select
          className="input-glass select-glass"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado"
          style={{ minWidth: '150px' }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {hasActiveFilters && (
        <button className="btn btn-secondary" onClick={onClearFilters} title="Limpiar filtros">
          <X size={14} /> Limpiar
        </button>
      )}

      {onExport && (
        <button className="btn btn-secondary" onClick={onExport} title="Exportar CSV (respeta filtros)">
          <Download size={14} /> Exportar CSV
        </button>
      )}
    </div>
  );
}

import React from 'react';
import { Search } from 'lucide-react';
import { CATEGORIES } from '../../utils/inventoryConstants';

export default function InventoryToolbar({
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter
}) {
  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
      <div style={{ position: 'relative', flexGrow: 1 }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar insumos por nombre..."
          className="input-glass"
          style={{ width: '100%', paddingLeft: '40px' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <select
        className="input-glass select-glass"
        value={categoryFilter}
        onChange={e => setCategoryFilter(e.target.value)}
        style={{ minWidth: '180px' }}
      >
        <option value="Todos">Todas las Categorías</option>
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
    </div>
  );
}

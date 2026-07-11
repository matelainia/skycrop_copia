import { useState, useMemo } from 'react';

export function useInventoryFilters(items) {
  const [activeWarehouse, setActiveWarehouse] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => {
      const matchesWarehouse = activeWarehouse === 'all' || item.warehouseId === activeWarehouse;
      const matchesCategory = categoryFilter === 'Todos' || item.category === categoryFilter;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      return matchesWarehouse && matchesCategory && matchesSearch;
    });
  }, [items, activeWarehouse, search, categoryFilter]);

  return {
    activeWarehouse,
    setActiveWarehouse,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    filteredItems
  };
}

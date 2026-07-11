import { useState, useMemo, useEffect } from 'react';

export function usePagination(items, itemsPerPage = 7, resetDeps = []) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page to 1 when filters or criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  const totalItems = items.length;
  const totalPages = useMemo(() => Math.ceil(totalItems / itemsPerPage) || 1, [totalItems, itemsPerPage]);

  const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
  const endIndex = useMemo(() => Math.min(startIndex + itemsPerPage, totalItems), [startIndex, itemsPerPage, totalItems]);

  const paginatedItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);

  const next = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const previous = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToPage = (page) => setCurrentPage(page);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    paginatedItems,
    next,
    previous,
    goToPage
  };
}

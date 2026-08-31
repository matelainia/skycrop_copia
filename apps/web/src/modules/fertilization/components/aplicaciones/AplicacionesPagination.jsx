import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function getPageNumbers(page, totalPages) {
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  // Ventana con elipsis
  pages.push(1);
  if (page > 3) pages.push('ellipsis-start');
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (page < totalPages - 2) pages.push('ellipsis-end');
  pages.push(totalPages);
  return pages;
}

const AplicacionesPagination = memo(function AplicacionesPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}) {
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="app-pagination" role="navigation" aria-label="Paginación de aplicaciones">
      <div className="app-pagination__counter" aria-live="polite">
        Mostrando {from}–{to} de {total} aplicaciones
      </div>
      <div className="app-pagination__controls">
        <button
          className="app-pagination__btn"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} />
        </button>
        {pageNumbers.map((p, idx) =>
          typeof p === 'string' ? (
            <span key={p + idx} className="app-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`app-pagination__page ${p === page ? 'app-pagination__page--active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-label={`Ir a página ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="app-pagination__btn"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="app-pagination__size">
        <label htmlFor="app-page-size" className="app-pagination__size-label">10 por página</label>
      </div>
    </div>
  );
});

export default AplicacionesPagination;

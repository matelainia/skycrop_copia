import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SoilPagination = memo(function SoilPagination({ page, totalPages, total, pageSize, onPageChange }) {
  const pages = useMemo(() => {
    const out = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }, [page, totalPages]);

  if (totalPages <= 1) {
    return (
      <div className="soil-pagination">
        <span className="soil-pagination__counter">
          Mostrando {total} resultado{total !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="soil-pagination" role="navigation" aria-label="Paginación">
      <span className="soil-pagination__counter">
        Mostrando {from} a {to} de {total} resultados
      </span>
      <div className="soil-pagination__controls">
        <button
          type="button"
          className="soil-pagination__btn"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {pages[0] > 1 && (
          <>
            <button type="button" className="soil-pagination__page" onClick={() => onPageChange(1)}>1</button>
            {pages[0] > 2 && <span className="soil-pagination__ellipsis">…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`soil-pagination__page ${p === page ? 'soil-pagination__page--active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-label={`Ir a página ${p}`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="soil-pagination__ellipsis">…</span>}
            <button type="button" className="soil-pagination__page" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}

        <button
          type="button"
          className="soil-pagination__btn"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
});

export default SoilPagination;

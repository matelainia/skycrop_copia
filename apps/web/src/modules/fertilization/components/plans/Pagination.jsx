/**
 * Pagination.jsx  ·  components/plans/
 * Paginación de la tabla de planes.
 *
 * Muestra: contador de registros + controles Anterior / números / Siguiente.
 * El número activo se muestra en verde (clase .pagination__page--active).
 *
 * @param {number}   page        - Página actual (1-indexed)
 * @param {number}   totalPages  - Total de páginas
 * @param {number}   total       - Total de registros
 * @param {number}   pageSize    - Registros por página
 * @param {function} onPageChange - Callback recibe el nuevo número de página
 */
import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Genera el array de páginas a mostrar con elipsis si hay más de 5 páginas */
function buildPageList(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, '…', total];
  if (current >= total - 2) return [1, '…', total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

const Pagination = React.memo(function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}) {
  const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  if (totalPages <= 1 && total === 0) return null;

  return (
    <div className="plans-pagination" aria-label="Paginación de planes de fertilización">
      {/* Contador */}
      <span className="plans-pagination__counter">
        Mostrando {from} a {to} de {total} {total === 1 ? 'plan' : 'planes'}
      </span>

      {/* Controles */}
      <div className="plans-pagination__controls" role="navigation" aria-label="Páginas">
        {/* Anterior */}
        <button
          className="plans-pagination__btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={15} />
          <span>Anterior</span>
        </button>

        {/* Números */}
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`ellipsis-${idx}`} className="plans-pagination__ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`plans-pagination__page ${p === page ? 'plans-pagination__page--active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
            >
              {p}
            </button>
          ),
        )}

        {/* Siguiente */}
        <button
          className="plans-pagination__btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <span>Siguiente</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
});

export default Pagination;

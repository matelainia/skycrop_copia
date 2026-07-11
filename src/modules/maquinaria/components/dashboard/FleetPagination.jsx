

export const FleetPagination = ({
  filteredCount,
  currentPage,
  setCurrentPage,
  rowsPerPage
}) => {
  const totalPages = Math.ceil(filteredCount / rowsPerPage) || 1;
  const startRow = Math.min(filteredCount, (currentPage - 1) * rowsPerPage + 1);
  const endRow = Math.min(filteredCount, currentPage * rowsPerPage);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        Mostrando {startRow} a {endRow} de {filteredCount} equipos
      </span>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '12px' }}
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(prev => prev - 1)}
        >
          &lt;
        </button>
        {[...Array(totalPages)].map((_, idx) => (
          <button
            key={idx}
            className={`btn ${currentPage === idx + 1 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => setCurrentPage(idx + 1)}
          >
            {idx + 1}
          </button>
        ))}
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '12px' }}
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(prev => prev + 1)}
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

export default FleetPagination;

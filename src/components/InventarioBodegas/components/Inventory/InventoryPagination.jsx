import React from 'react';

export default function InventoryPagination({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  onPageChange
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        {totalItems > 0 ? (
          `${startIndex + 1}-${endIndex} de ${totalItems} artículos`
        ) : (
          '0-0 de 0 artículos'
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Pág.</span>
        <select
          value={currentPage}
          onChange={e => onPageChange(Number(e.target.value))}
          className="input-glass select-glass"
          style={{ padding: '4px 28px 4px 10px', fontSize: '13px', minWidth: '60px', height: '32px' }}
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
          >
            |&lt;
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
          >
            &lt;
          </button>
          <button
            className="btn btn-primary"
            style={{ padding: '6px 12px', height: '32px', fontSize: '12px', cursor: 'default' }}
          >
            {currentPage}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
          >
            &gt;
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            style={{ padding: '6px 10px', height: '32px', fontSize: '12px' }}
          >
            &gt;|
          </button>
        </div>
      </div>
    </div>
  );
}

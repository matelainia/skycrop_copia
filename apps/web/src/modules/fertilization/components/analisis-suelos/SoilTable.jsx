import { memo } from 'react';
import SoilRow from './SoilRow.jsx';
import SoilSkeleton from './SoilSkeleton.jsx';
import { EmptyState, NoResultsState, ErrorState } from './SoilEmptyState.jsx';

const HEADERS = [
  { key: 'fecha', label: 'Fecha de análisis' },
  { key: 'lote', label: 'Lote / Sector' },
  { key: 'zona', label: 'Zona de muestreo' },
  { key: 'laboratorio', label: 'Laboratorio' },
  { key: 'parametros', label: 'Parámetros principales' },
  { key: 'acciones', label: 'Acciones' },
];

const SoilTable = memo(function SoilTable({
  analyses = [],
  loading = false,
  isFetching = false,
  error = null,
  hasNoData = false,
  hasNoResults = false,
  selectedId = null,
  onAction,
  onRetry,
  onClearFilters,
  onNew,
}) {
  const showSkeleton = loading;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && hasNoData;
  const showNoResults = !loading && !error && hasNoResults;
  const showData = !loading && !error && !hasNoData && !hasNoResults && analyses.length > 0;

  return (
    <div
      className={`soil-table-wrapper ${isFetching ? 'app-table--fetching' : ''}`}
      role="region"
      aria-label="Tabla de análisis de suelos"
    >
      <table className="soil-table" role="table" aria-label="Análisis de suelos" aria-busy={loading || isFetching}>
        <thead className="soil-table__head">
          <tr>
            {HEADERS.map((h) => (
              <th key={h.key} scope="col" className="soil-table__th" data-col={h.key}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="soil-table__body">
          {showSkeleton && <SoilSkeleton rows={5} />}
          {showError && (
            <tr><td colSpan={HEADERS.length} style={{ padding: 0 }}><ErrorState error={error} onRetry={onRetry} /></td></tr>
          )}
          {showEmpty && (
            <tr><td colSpan={HEADERS.length} style={{ padding: 0 }}><EmptyState onNew={onNew} /></td></tr>
          )}
          {showNoResults && (
            <tr><td colSpan={HEADERS.length} style={{ padding: 0 }}><NoResultsState onClear={onClearFilters} /></td></tr>
          )}
          {showData && analyses.map((a) => (
            <SoilRow
              key={a.id}
              analisis={a}
              isSelected={selectedId === a.id}
              onAction={onAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default SoilTable;

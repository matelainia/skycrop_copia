import { memo } from 'react';
import ApplicationRow from './ApplicationRow.jsx';
import AplicacionesSkeleton from './AplicacionesSkeleton.jsx';
import { EmptyState, NoResultsState, ErrorState } from './AplicacionesEmptyState.jsx';

const HEADERS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'lote', label: 'Lote / Sector' },
  { key: 'cultivo', label: 'Cultivo' },
  { key: 'fase', label: 'Fase Fenológica' },
  { key: 'fertilizantes', label: 'Fertilizantes Aplicados' },
  { key: 'metodo', label: 'Método' },
  { key: 'nutrientes', label: 'Nutrientes (kg)' },
  { key: 'estado', label: 'Estado' },
  { key: 'acciones', label: 'Acciones' },
];

const AplicacionesTable = memo(function AplicacionesTable({
  aplicaciones = [],
  loading = false,
  error = null,
  hasNoData = false,
  hasNoResults = false,
  onAction,
  onRetry,
  onClearFilters,
  onNewAplicacion,
  isFetching = false,
}) {
  const showSkeleton = loading;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && hasNoData;
  const showNoResults = !loading && !error && hasNoResults;
  const showData = !loading && !error && !hasNoData && !hasNoResults && aplicaciones.length > 0;

  return (
    <div className={`app-table-wrapper ${isFetching ? 'app-table--fetching' : ''}`} role="region" aria-label="Tabla de aplicaciones de fertilización">
      <table className="app-table" role="table" aria-label="Aplicaciones de fertilización" aria-busy={loading || isFetching}>
        <thead className="app-table__head">
          <tr>
            {HEADERS.map((h) => (
              <th key={h.key} scope="col" className="app-table__th" data-col={h.key}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="app-table__body">
          {showSkeleton && <AplicacionesSkeleton rows={5} />}
          {showError && (
            <tr><td colSpan={HEADERS.length} style={{ padding: 0 }}><ErrorState error={error} onRetry={onRetry} /></td></tr>
          )}
          {showEmpty && (
            <tr><td colSpan={HEADERS.length} style={{ padding: 0 }}><EmptyState onNewAplicacion={onNewAplicacion} /></td></tr>
          )}
          {showNoResults && (
            <tr><td colSpan={HEADERS.length} style={{ padding: 0 }}><NoResultsState onClear={onClearFilters} /></td></tr>
          )}
          {showData && aplicaciones.map((app) => (
            <ApplicationRow key={app.id} aplicacion={app} onAction={onAction} />
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default AplicacionesTable;

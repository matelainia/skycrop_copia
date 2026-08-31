import { memo } from 'react';
import { FlaskConical, SearchX, AlertTriangle, FileText } from 'lucide-react';

export const EmptyState = memo(function EmptyState({ onNew }) {
  return (
    <div className="soil-empty" role="status" aria-label="Sin análisis de suelos">
      <div className="soil-empty__icon"><FlaskConical size={24} /></div>
      <div className="soil-empty__title">No hay análisis de suelo</div>
      <div className="soil-empty__subtitle">
        Registra el primer análisis de suelo para comenzar a construir el historial nutricional del predio.
      </div>
      {onNew && (
        <button type="button" className="fert-btn fert-btn--primary" onClick={onNew}>
          + Nuevo análisis
        </button>
      )}
    </div>
  );
});

export const NoResultsState = memo(function NoResultsState({ onClear }) {
  return (
    <div className="soil-empty" role="status" aria-label="Sin resultados de búsqueda">
      <div className="soil-empty__icon"><SearchX size={24} /></div>
      <div className="soil-empty__title">No encontramos análisis con estos filtros</div>
      <div className="soil-empty__subtitle">
        Intenta ajustar los filtros o limpiar la búsqueda para ver todos los registros.
      </div>
      {onClear && (
        <button type="button" className="fert-btn fert-btn--outline" onClick={onClear}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
});

export const ErrorState = memo(function ErrorState({ error, onRetry }) {
  return (
    <div className="soil-error" role="alert" aria-label="Error al cargar análisis">
      <div className="soil-error__icon"><AlertTriangle size={20} /></div>
      <div className="soil-empty__title" style={{ color: '#DC2626' }}>No fue posible cargar los análisis</div>
      <div className="soil-error__msg">{error || 'Intenta nuevamente en unos segundos.'}</div>
      {onRetry && (
        <button type="button" className="fert-btn fert-btn--primary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
});

export const EmptyResultsPreview = memo(function EmptyResultsPreview() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 12 }}>
      <FileText size={14} /> Sin resultados registrados
    </div>
  );
});

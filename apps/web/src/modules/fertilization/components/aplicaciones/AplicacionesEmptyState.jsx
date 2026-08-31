import { memo } from 'react';
import { Leaf, SearchX } from 'lucide-react';

export const EmptyState = memo(function EmptyState({ onNewAplicacion }) {
  return (
    <div className="app-empty" role="status" aria-label="No hay aplicaciones registradas">
      <div className="app-empty__icon-tile" aria-hidden="true">
        <Leaf size={26} />
      </div>
      <div className="app-empty__title">No hay aplicaciones registradas</div>
      <div className="app-empty__subtitle">
        Registra la primera aplicación de fertilización para comenzar el seguimiento
      </div>
      {onNewAplicacion && (
        <button className="fert-btn fert-btn--primary" onClick={onNewAplicacion} aria-label="Crear nueva aplicación de fertilización">
          + Nueva Aplicación
        </button>
      )}
    </div>
  );
});

export const NoResultsState = memo(function NoResultsState({ onClear }) {
  return (
    <div className="app-empty" role="status" aria-label="Sin resultados para los filtros aplicados">
      <div className="app-empty__icon-tile" aria-hidden="true" style={{ background: 'rgba(107,114,128,0.08)', color: '#6B7280', borderColor: 'rgba(107,114,128,0.15)' }}>
        <SearchX size={26} />
      </div>
      <div className="app-empty__title">No encontramos aplicaciones</div>
      <div className="app-empty__subtitle">Prueba modificando los filtros de búsqueda.</div>
      {onClear && (
        <button className="fert-btn fert-btn--outline" onClick={onClear} aria-label="Limpiar filtros">
          Limpiar filtros
        </button>
      )}
    </div>
  );
});

export const ErrorState = memo(function ErrorState({ error, onRetry }) {
  const isPermission = typeof error === 'string' && /permiso|permission|not allowed|RLS|jwt|unauthorized/i.test(error);
  const title = isPermission ? 'Sin permisos' : 'No fue posible cargar las aplicaciones';
  const message = isPermission
    ? 'No tienes permisos para consultar las aplicaciones de esta empresa.'
    : (error || 'Ocurrió un error inesperado. Inténtalo de nuevo.');
  return (
    <div className="app-empty" role="alert" aria-label={title}>
      <div className="app-empty__icon-tile" aria-hidden="true" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', borderColor: 'rgba(220,38,38,0.15)' }}>
        <span style={{ fontSize: 22 }}>!</span>
      </div>
      <div className="app-empty__title">{title}</div>
      <div className="app-empty__subtitle">{message}</div>
      {onRetry && (
        <button className="fert-btn fert-btn--primary" onClick={onRetry} aria-label="Reintentar carga de aplicaciones">
          Reintentar
        </button>
      )}
    </div>
  );
});

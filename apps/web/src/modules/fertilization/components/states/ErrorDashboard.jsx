import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * ErrorDashboard
 * Shown when useFertilizationDashboard() returns an error.
 * Provides a retry button that calls refetch().
 *
 * @param {Error|null} error
 * @param {function} onRetry - calls refetch() from the hook
 */
export default function ErrorDashboard({ error, onRetry }) {
  return (
    <div className="fert-error">
      <div className="fert-error__icon">
        <AlertCircle size={28} />
      </div>
      <div className="fert-error__title">Error al cargar el dashboard</div>
      <div className="fert-error__msg">
        {error?.message || 'Ocurrió un problema al obtener los datos de fertilización. Por favor intenta nuevamente.'}
      </div>
      <button
        className="fert-btn fert-btn--primary"
        onClick={onRetry}
        aria-label="Reintentar carga del dashboard"
      >
        <RefreshCw size={16} />
        Reintentar
      </button>
    </div>
  );
}

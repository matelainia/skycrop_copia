import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Search, Filter, X, Calendar, ChevronDown } from 'lucide-react';
import { APP_STATUS_LABELS } from '../../types/aplicaciones.types.js';

/**
 * AplicacionesToolbar — Barra de búsqueda y filtros interactiva.
 * - Search con debounce (manejado en hook, aquí solo controlled input)
 * - Lote/Sector dropdown (datos reales)
 * - Estado dropdown (valores reales de BD)
 * - Fecha desde / hasta
 * - Botón Filtros avanzados (popover preparado)
 */
function AplicacionesToolbar({
  filters,
  lotes = [],
  onFiltersChange,
  onReset,
  activeFiltersCount = 0,
  lotesLoading = false,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedRef = useRef(null);

  useEffect(() => {
    if (!showAdvanced) return;
    const handleOutside = (e) => {
      if (advancedRef.current && !advancedRef.current.contains(e.target)) setShowAdvanced(false);
    };
    const handleEsc = (e) => { if (e.key === 'Escape') setShowAdvanced(false); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showAdvanced]);

  const handleChange = useCallback((key, value) => {
    onFiltersChange?.({ [key]: value });
  }, [onFiltersChange]);

  const hasActive = activeFiltersCount > 0;

  return (
    <div className="app-toolbar" role="search" aria-label="Filtros de aplicaciones de fertilización">
      {/* Buscar */}
      <div className="app-toolbar__search">
        <Search size={16} className="app-toolbar__search-icon" aria-hidden="true" />
        <input
          type="search"
          className="app-toolbar__search-input"
          placeholder="Buscar aplicaciones..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          aria-label="Buscar por lote, sector, fertilizante o cultivo"
          id="app-search-input"
        />
        {filters.search && (
          <button
            className="app-toolbar__search-clear"
            onClick={() => handleChange('search', '')}
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lote / Sector */}
      <div className="app-toolbar__filter">
        <label className="app-toolbar__label" htmlFor="filter-lote">Lote / Sector</label>
        <div className="app-toolbar__select-wrap">
          <select
            id="filter-lote"
            className="fert-dropdown app-toolbar__select"
            value={filters.lotId}
            onChange={(e) => handleChange('lotId', e.target.value)}
            aria-label="Filtrar por lote o sector"
            disabled={lotesLoading}
          >
            <option value="">Todos</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>{l.label || l.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado */}
      <div className="app-toolbar__filter">
        <label className="app-toolbar__label" htmlFor="filter-estado">Estado</label>
        <div className="app-toolbar__select-wrap">
          <select
            id="filter-estado"
            className="fert-dropdown app-toolbar__select"
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos</option>
            {Object.entries(APP_STATUS_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha desde */}
      <div className="app-toolbar__filter">
        <label className="app-toolbar__label" htmlFor="filter-date-from">Fecha desde</label>
        <div className="app-toolbar__date-wrap">
          <input
            type="date"
            id="filter-date-from"
            className="app-toolbar__date"
            value={filters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            aria-label="Fecha desde"
          />
          <Calendar size={14} className="app-toolbar__date-icon" aria-hidden="true" />
        </div>
      </div>

      {/* Fecha hasta */}
      <div className="app-toolbar__filter">
        <label className="app-toolbar__label" htmlFor="filter-date-hasta">Fecha hasta</label>
        <div className="app-toolbar__date-wrap">
          <input
            type="date"
            id="filter-date-hasta"
            className="app-toolbar__date"
            value={filters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            aria-label="Fecha hasta"
          />
          <Calendar size={14} className="app-toolbar__date-icon" aria-hidden="true" />
        </div>
      </div>

      {/* Filtros avanzados + Limpiar */}
      <div className="app-toolbar__actions">
        <div className="app-toolbar__advanced" ref={advancedRef}>
          <button
            className="fert-btn fert-btn--outline app-toolbar__filter-btn"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-label="Filtros avanzados"
            aria-haspopup="true"
            aria-expanded={showAdvanced}
            id="app-advanced-filters-btn"
          >
            <Filter size={14} aria-hidden="true" />
            Filtros {hasActive ? `(${activeFiltersCount})` : ''}
            <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 150ms ease' }} />
          </button>
          {showAdvanced && (
            <div className="app-toolbar__popover" role="dialog" aria-label="Filtros avanzados">
              <div className="app-toolbar__popover-header">Filtros avanzados</div>
              <div className="app-toolbar__popover-body">
                <p className="app-toolbar__popover-text">
                  Filtros adicionales como método de aplicación, fase fenológica, fertilizante, nutrientes, responsable y rango de dosis estarán disponibles cuando esos campos existan en Supabase.
                </p>
                <p className="app-toolbar__popover-hint">
                  No se muestran filtros para campos que aún no existen en el modelo de datos real.
                </p>
              </div>
              <div className="app-toolbar__popover-footer">
                <button className="fert-btn fert-btn--ghost" onClick={() => setShowAdvanced(false)}>Cerrar</button>
              </div>
            </div>
          )}
        </div>

        {hasActive && (
          <button
            className="fert-btn fert-btn--ghost"
            onClick={onReset}
            aria-label="Limpiar todos los filtros"
            id="app-reset-filters-btn"
          >
            <X size={14} aria-hidden="true" />
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(AplicacionesToolbar);

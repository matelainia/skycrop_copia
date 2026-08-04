/**
 * PlanFilters.jsx  ·  components/plans/
 * Barra de filtros horizontal para la tabla de planes de fertilización.
 *
 * Controles:
 *   - Buscador: name, code, lotName, cropName, farmName
 *   - Select Predio (farmId)
 *   - Select Cultivo (cropId)
 *   - Select Estado Trabajo (status)
 *   - Select Vigencia (validityStatus)
 *   - Date range (dateFrom / dateTo)
 *   - Botón Filtros avanzados (preparado, no-op por ahora)
 *
 * @param {object}   filters          - Estado actual de filtros
 * @param {function} onFiltersChange  - Callback con los nuevos filtros
 * @param {function} onReset          - Limpia todos los filtros
 */
import React, { useCallback, useMemo } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { CROPS, PLAN_STATUS_LABELS, VALIDITY_STATUS_LABELS } from '../../types/fertilization.types.js';
import { mockPlansData } from '../../data/mockPlans.js';

/** Extrae predios únicos del mock (en producción vendría de Supabase) */
function getUniqueFarms() {
  const seen = new Map();
  mockPlansData.forEach((p) => {
    if (!seen.has(p.farmId)) seen.set(p.farmId, { id: p.farmId, name: p.farmName });
  });
  return [...seen.values()];
}

const FARMS = getUniqueFarms();

const PlanFilters = React.memo(function PlanFilters({ filters, onFiltersChange, onReset }) {
  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ''),
    [filters],
  );

  const handleChange = useCallback(
    (key, value) => {
      onFiltersChange({ [key]: value });
    },
    [onFiltersChange],
  );

  return (
    <div className="plans-filters" role="search" aria-label="Filtros de planes de fertilización">
      {/* Buscador */}
      <div className="plans-search">
        <Search size={15} className="plans-search__icon" aria-hidden="true" />
        <input
          type="search"
          className="plans-search__input"
          placeholder="Buscar plan, lote o cultivo..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          aria-label="Buscar planes de fertilización"
          id="plans-search-input"
        />
        {filters.search && (
          <button
            className="plans-search__clear"
            onClick={() => handleChange('search', '')}
            aria-label="Limpiar búsqueda"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Select Predio */}
      <div className="plans-filter-group">
        <label className="plans-filter-label" htmlFor="filter-farm">Predio / Lote</label>
        <select
          id="filter-farm"
          className="fert-dropdown plans-filter-select"
          value={filters.farmId}
          onChange={(e) => handleChange('farmId', e.target.value)}
          aria-label="Filtrar por predio"
        >
          <option value="">Todos</option>
          {FARMS.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Select Cultivo */}
      <div className="plans-filter-group">
        <label className="plans-filter-label" htmlFor="filter-crop">Cultivo</label>
        <select
          id="filter-crop"
          className="fert-dropdown plans-filter-select"
          value={filters.cropId}
          onChange={(e) => handleChange('cropId', e.target.value)}
          aria-label="Filtrar por cultivo"
        >
          <option value="">Todos</option>
          {CROPS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Select Estado */}
      <div className="plans-filter-group">
        <label className="plans-filter-label" htmlFor="filter-status">Estado</label>
        <select
          id="filter-status"
          className="fert-dropdown plans-filter-select"
          value={filters.status}
          onChange={(e) => handleChange('status', e.target.value)}
          aria-label="Filtrar por estado del plan"
        >
          <option value="">Todos</option>
          {Object.entries(PLAN_STATUS_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>

      {/* Select Vigencia */}
      <div className="plans-filter-group">
        <label className="plans-filter-label" htmlFor="filter-validity">Vigencia</label>
        <select
          id="filter-validity"
          className="fert-dropdown plans-filter-select"
          value={filters.validityStatus}
          onChange={(e) => handleChange('validityStatus', e.target.value)}
          aria-label="Filtrar por vigencia agronómica"
        >
          <option value="">Todas</option>
          {Object.entries(VALIDITY_STATUS_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>

      {/* Fecha rango */}
      <div className="plans-filter-group plans-filter-group--date">
        <label className="plans-filter-label" htmlFor="filter-date-from">Fecha</label>
        <div className="plans-date-range">
          <input
            type="date"
            id="filter-date-from"
            className="plans-date-input"
            value={filters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            aria-label="Fecha desde"
          />
          <span className="plans-date-sep">—</span>
          <input
            type="date"
            id="filter-date-to"
            className="plans-date-input"
            value={filters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            aria-label="Fecha hasta"
          />
        </div>
      </div>

      {/* Botón filtros avanzados */}
      <button
        className="fert-btn fert-btn--outline plans-filter-btn"
        aria-label="Filtros avanzados"
        id="plans-advanced-filters-btn"
      >
        <Filter size={14} aria-hidden="true" />
        Filtros
      </button>

      {/* Limpiar filtros */}
      {hasActiveFilters && (
        <button
          className="fert-btn fert-btn--ghost plans-filter-reset"
          onClick={onReset}
          aria-label="Limpiar todos los filtros"
          id="plans-reset-filters-btn"
        >
          <X size={14} aria-hidden="true" />
          Limpiar
        </button>
      )}
    </div>
  );
});

export default PlanFilters;

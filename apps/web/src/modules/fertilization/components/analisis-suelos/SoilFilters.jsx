import { memo, useCallback } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

const SoilFilters = memo(function SoilFilters({
  filters,
  onFiltersChange,
  onReset,
  activeFiltersCount = 0,
  predios = [],
  lotes = [],
  laboratorios = [],
  years = [],
  prediosLoading = false,
  lotesLoading = false,
  labsLoading = false,
}) {
  const handleSearch = useCallback((e) => {
    onFiltersChange({ search: e.target.value });
  }, [onFiltersChange]);

  const clearSearch = useCallback(() => {
    onFiltersChange({ search: '' });
  }, [onFiltersChange]);

  return (
    <div className="soil-toolbar" role="search" aria-label="Filtros de análisis de suelos">
      {/* Buscar */}
      <div className="soil-toolbar__search">
        <Search size={16} className="soil-toolbar__search-icon" aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar análisis..."
          value={filters.search || ''}
          onChange={handleSearch}
          className="soil-toolbar__search-input"
          aria-label="Buscar análisis de suelos"
        />
        {filters.search && (
          <button
            type="button"
            onClick={clearSearch}
            className="soil-toolbar__search-clear"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lote / Sector */}
      <div className="soil-toolbar__filter">
        <label className="soil-toolbar__label">Lote / Sector</label>
        <select
          value={filters.loteId || ''}
          onChange={(e) => onFiltersChange({ loteId: e.target.value })}
          className="fert-dropdown soil-toolbar__select"
          aria-label="Filtrar por lote"
          disabled={lotesLoading}
        >
          <option value="">Todos</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>{l.label || l.nombre}</option>
          ))}
        </select>
      </div>

      {/* Predio (opcional) */}
      {predios.length > 0 && (
        <div className="soil-toolbar__filter">
          <label className="soil-toolbar__label">Predio</label>
          <select
            value={filters.predioId || ''}
            onChange={(e) => onFiltersChange({ predioId: e.target.value, loteId: '' })}
            className="fert-dropdown soil-toolbar__select"
            aria-label="Filtrar por predio"
            disabled={prediosLoading}
          >
            <option value="">Todos</option>
            {predios.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Laboratorio */}
      <div className="soil-toolbar__filter">
        <label className="soil-toolbar__label">Laboratorio</label>
        <select
          value={filters.laboratorioId || ''}
          onChange={(e) => onFiltersChange({ laboratorioId: e.target.value })}
          className="fert-dropdown soil-toolbar__select"
          aria-label="Filtrar por laboratorio"
          disabled={labsLoading}
        >
          <option value="">Todos</option>
          {laboratorios.map((lab) => (
            <option key={lab.id} value={lab.id}>{lab.nombre}</option>
          ))}
        </select>
      </div>

      {/* Año */}
      <div className="soil-toolbar__filter">
        <label className="soil-toolbar__label">Año</label>
        <select
          value={filters.year || ''}
          onChange={(e) => onFiltersChange({ year: e.target.value })}
          className="fert-dropdown soil-toolbar__select"
          aria-label="Filtrar por año"
        >
          <option value="">Todos</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Estado */}
      <div className="soil-toolbar__filter">
        <label className="soil-toolbar__label">Estado</label>
        <select
          value={filters.estado || ''}
          onChange={(e) => onFiltersChange({ estado: e.target.value })}
          className="fert-dropdown soil-toolbar__select"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          <option value="borrador">Borrador</option>
          <option value="completo">Completado</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>

      <div className="soil-toolbar__actions">
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="fert-btn fert-btn--ghost"
            style={{ fontSize: 13 }}
          >
            <X size={14} /> Limpiar filtros
          </button>
        )}
        <button
          type="button"
          className="fert-btn fert-btn--outline"
          aria-label="Filtros avanzados"
          onClick={() => {
            // Toggle hasGps / hasPdf rápido
            const hasGps = filters.hasGps === true ? null : true;
            // Noop: placeholder para filtros avanzados (con GPS / con PDF)
            // Se deja como ejemplo; no altera filtros automáticamente
          }}
          style={{ display: 'none' }}
        >
          <SlidersHorizontal size={14} /> Filtros
        </button>
      </div>
    </div>
  );
});

export default SoilFilters;

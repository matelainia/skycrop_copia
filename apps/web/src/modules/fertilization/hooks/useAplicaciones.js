/**
 * useAplicaciones.js
 * Hook de estado y fetching para la tabla de Aplicaciones.
 *
 * Responsabilidad exclusiva: UI state (filtros, paginación, búsqueda con debounce).
 * No contiene lógica de datos (service/repository).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { aplicacionesService } from '../services/aplicaciones.service.js';

const DEFAULT_FILTERS = {
  search: '',
  lotId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
};

const DEFAULT_PAGE_SIZE = 10;

export function useAplicaciones(options = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE, debounceMs = 350 } = options;

  const [aplicaciones, setAplicaciones] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [filters, setFiltersState] = useState(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  // Stats para tarjetas de resumen
  const [stats, setStats] = useState({ total: 0, lastApp: null, lotsWithApps: 0, totalLots: 0, nutrientsKg: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // Lotes para dropdown
  const [lotes, setLotes] = useState([]);
  const [lotesLoading, setLotesLoading] = useState(true);

  const abortRef = useRef(0);

  // Debounce para search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [filters.search, debounceMs]);

  // Cargar lotes una vez
  useEffect(() => {
    let cancelled = false;
    async function loadLotes() {
      setLotesLoading(true);
      try {
        const data = await aplicacionesService.getLotesForFilter();
        if (!cancelled) setLotes(data);
      } catch (_) {
        if (!cancelled) setLotes([]);
      } finally {
        if (!cancelled) setLotesLoading(false);
      }
    }
    loadLotes();
    return () => { cancelled = true; };
  }, []);

  // Cargar stats (se recarga cuando cambian filtros relevantes? No — stats globales)
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const s = await aplicacionesService.getStats();
      setStats(s);
    } catch (err) {
      setStatsError(err?.message || 'Error al cargar métricas');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch principal
  const fetchAplicaciones = useCallback(async (currentFilters, currentPage, currentDebouncedSearch) => {
    const fetchId = ++abortRef.current;
    setIsFetching(true);
    if (currentPage === 1) setLoading(true);
    setError(null);
    try {
      const result = await aplicacionesService.getAplicaciones({
        page: currentPage,
        pageSize,
        search: currentDebouncedSearch,
        lotId: currentFilters.lotId,
        status: currentFilters.status,
        dateFrom: currentFilters.dateFrom,
        dateTo: currentFilters.dateTo,
      });
      if (fetchId !== abortRef.current) return;
      setAplicaciones(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (fetchId !== abortRef.current) return;
      setError(err?.message || 'No fue posible cargar las aplicaciones.');
      setAplicaciones([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      if (fetchId === abortRef.current) {
        setLoading(false);
        setIsFetching(false);
      }
    }
  }, [pageSize]);

  useEffect(() => {
    fetchAplicaciones(filters, page, debouncedSearch);
  }, [filters.lotId, filters.status, filters.dateFrom, filters.dateTo, debouncedSearch, page, fetchAplicaciones]);

  // Setters de filtros (cumplen spec: persistir, limpiar, contar activos)
  const setFilters = useCallback((patch) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
    // Si cambia cualquier filtro distinto de search, resetear página
    if (patch.search === undefined) setPage(1);
  }, []);

  const setSearch = useCallback((value) => {
    setFiltersState((prev) => ({ ...prev, search: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setDebouncedSearch('');
    setPage(1);
  }, []);

  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (filters.lotId) c += 1;
    if (filters.status) c += 1;
    if (filters.dateFrom) c += 1;
    if (filters.dateTo) c += 1;
    if (debouncedSearch) c += 1;
    return c;
  }, [filters.lotId, filters.status, filters.dateFrom, filters.dateTo, debouncedSearch]);

  const refetch = useCallback(() => {
    fetchAplicaciones(filters, page, debouncedSearch);
    fetchStats();
  }, [fetchAplicaciones, fetchStats, filters, page, debouncedSearch]);

  const hasNoData = !loading && !error && total === 0 && activeFiltersCount === 0;
  const hasNoResults = !loading && !error && aplicaciones.length === 0 && activeFiltersCount > 0;

  // ── Escritura por usuario (comunicación Supabase con aislamiento por empresa) ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const createAplicacion = useCallback(async (payload, context) => {
    setSaving(true);
    setSaveError(null);
    try {
      const created = await aplicacionesService.createAplicacion(payload, context);
      await fetchAplicaciones(filters, page, debouncedSearch);
      await fetchStats();
      return created;
    } catch (err) {
      const msg = err?.message || 'No fue posible guardar la aplicación.';
      setSaveError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAplicaciones, fetchStats, filters, page, debouncedSearch]);

  const updateAplicacion = useCallback(async (id, patch, context) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await aplicacionesService.updateAplicacion(id, patch, context);
      await fetchAplicaciones(filters, page, debouncedSearch);
      return updated;
    } catch (err) {
      setSaveError(err?.message || 'Error al actualizar.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAplicaciones, filters, page, debouncedSearch]);

  const deleteAplicacion = useCallback(async (id) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await aplicacionesService.deleteAplicacion(id);
      await fetchAplicaciones(filters, page, debouncedSearch);
      await fetchStats();
      return res;
    } catch (err) {
      setSaveError(err?.message || 'Error al eliminar.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAplicaciones, fetchStats, filters, page, debouncedSearch]);

  return {
    // data
    aplicaciones,
    total,
    totalPages,
    page,
    pageSize,
    // filtros
    filters,
    debouncedSearch,
    activeFiltersCount,
    setFilters,
    setSearch,
    resetFilters,
    setPage,
    // estado
    loading,
    isFetching,
    error,
    hasNoData,
    hasNoResults,
    saving,
    saveError,
    // stats
    stats,
    statsLoading,
    statsError,
    // lotes
    lotes,
    lotesLoading,
    // acciones
    refetch,
    fetchStats,
    createAplicacion,
    updateAplicacion,
    deleteAplicacion,
  };
}

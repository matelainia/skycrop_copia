/**
 * useSoilAnalysis.js
 * Hook principal para el módulo Análisis de Suelos.
 * Gestiona filtros, paginación, búsqueda con debounce, métricas y estados vacíos.
 * Cero mocks — todo derivado de Supabase.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { soilAnalysisService } from '../services/soilAnalysis.service.js';

const DEFAULT_FILTERS = {
  search: '',
  predioId: '',
  loteId: '',
  laboratorioId: '',
  year: '',
  estado: '',
  hasGps: null,
  hasPdf: null,
};

const DEFAULT_PAGE_SIZE = 10;

export function useSoilAnalysis(options = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE, debounceMs = 350 } = options;

  const [analyses, setAnalyses] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [filters, setFiltersState] = useState(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const [metrics, setMetrics] = useState({ total: 0, esteAno: 0, zonas: 0, laboratorios: 0, ultimo: null });
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [predios, setPredios] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [years, setYears] = useState([]);
  const [parametros, setParametros] = useState([]);

  const [prediosLoading, setPrediosLoading] = useState(true);
  const [lotesLoading, setLotesLoading] = useState(true);
  const [labsLoading, setLabsLoading] = useState(true);

  const abortRef = useRef(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [filters.search, debounceMs]);

  // Cargar catálogos una vez
  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      setPrediosLoading(true);
      setLotesLoading(true);
      setLabsLoading(true);
      try {
        const [prediosData, lotesData, labsData, yearsData, paramsData] = await Promise.all([
          soilAnalysisService.getPredios().catch(() => []),
          soilAnalysisService.getLotes().catch(() => []),
          soilAnalysisService.getLaboratorios().catch(() => []),
          soilAnalysisService.getYears().catch(() => []),
          soilAnalysisService.getParametros().catch(() => []),
        ]);
        if (!cancelled) {
          setPredios(prediosData);
          setLotes(lotesData);
          setLaboratorios(labsData);
          setYears(yearsData);
          setParametros(paramsData);
        }
      } finally {
        if (!cancelled) {
          setPrediosLoading(false);
          setLotesLoading(false);
          setLabsLoading(false);
        }
      }
    }
    loadCatalogs();
    return () => { cancelled = true; };
  }, []);

  // Recargar lotes cuando cambia predio
  useEffect(() => {
    if (!filters.predioId) return;
    let cancelled = false;
    async function reloadLotes() {
      setLotesLoading(true);
      try {
        const data = await soilAnalysisService.getLotes(filters.predioId);
        if (!cancelled) setLotes(data);
      } catch {
        if (!cancelled) setLotes([]);
      } finally {
        if (!cancelled) setLotesLoading(false);
      }
    }
    reloadLotes();
    return () => { cancelled = true; };
  }, [filters.predioId]);

  // Métricas
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const m = await soilAnalysisService.getMetrics();
      setMetrics(m);
    } catch {
      // dejar métricas en 0 si falla (estado vacío real)
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Fetch principal
  const fetchAnalyses = useCallback(async (currentFilters, currentPage, currentSearch) => {
    const fetchId = ++abortRef.current;
    setIsFetching(true);
    if (currentPage === 1) setLoading(true);
    setError(null);
    try {
      const result = await soilAnalysisService.getAnalyses({
        page: currentPage,
        pageSize,
        search: currentSearch,
        predioId: currentFilters.predioId,
        loteId: currentFilters.loteId,
        laboratorioId: currentFilters.laboratorioId,
        year: currentFilters.year,
        estado: currentFilters.estado,
        hasGps: currentFilters.hasGps,
        hasPdf: currentFilters.hasPdf,
      });
      if (fetchId !== abortRef.current) return;
      setAnalyses(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (fetchId !== abortRef.current) return;
      setError(err?.message || 'No fue posible cargar los análisis de suelo.');
      setAnalyses([]);
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
    fetchAnalyses(filters, page, debouncedSearch);
  }, [
    filters.predioId, filters.loteId, filters.laboratorioId, filters.year, filters.estado,
    filters.hasGps, filters.hasPdf,
    debouncedSearch, page, fetchAnalyses
  ]);

  const setFilters = useCallback((patch) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
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
    if (filters.predioId) c += 1;
    if (filters.loteId) c += 1;
    if (filters.laboratorioId) c += 1;
    if (filters.year) c += 1;
    if (filters.estado) c += 1;
    if (filters.hasGps != null) c += 1;
    if (filters.hasPdf != null) c += 1;
    if (debouncedSearch) c += 1;
    return c;
  }, [filters.predioId, filters.loteId, filters.laboratorioId, filters.year, filters.estado, filters.hasGps, filters.hasPdf, debouncedSearch]);

  const refetch = useCallback(() => {
    fetchAnalyses(filters, page, debouncedSearch);
    fetchMetrics();
  }, [fetchAnalyses, fetchMetrics, filters, page, debouncedSearch]);

  const hasNoData = !loading && !error && total === 0 && activeFiltersCount === 0;
  const hasNoResults = !loading && !error && analyses.length === 0 && activeFiltersCount > 0;

  // Escritura
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const createAnalisis = useCallback(async (payload, context) => {
    setSaving(true);
    setSaveError(null);
    try {
      const created = await soilAnalysisService.createAnalisis(payload, context);
      await fetchAnalyses(filters, page, debouncedSearch);
      await fetchMetrics();
      return created;
    } catch (err) {
      setSaveError(err?.message || 'No fue posible guardar el análisis.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAnalyses, fetchMetrics, filters, page, debouncedSearch]);

  const updateAnalisis = useCallback(async (id, patch, context) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await soilAnalysisService.updateAnalisis(id, patch, context);
      await fetchAnalyses(filters, page, debouncedSearch);
      return updated;
    } catch (err) {
      setSaveError(err?.message || 'Error al actualizar.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAnalyses, filters, page, debouncedSearch]);

  const deleteAnalisis = useCallback(async (id) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await soilAnalysisService.deleteAnalisis(id);
      await fetchAnalyses(filters, page, debouncedSearch);
      await fetchMetrics();
      return res;
    } catch (err) {
      setSaveError(err?.message || 'Error al eliminar.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAnalyses, fetchMetrics, filters, page, debouncedSearch]);

  const archiveAnalisis = useCallback(async (id) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await soilAnalysisService.archiveAnalisis(id);
      await fetchAnalyses(filters, page, debouncedSearch);
      await fetchMetrics();
      return res;
    } catch (err) {
      setSaveError(err?.message || 'Error al archivar.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAnalyses, fetchMetrics, filters, page, debouncedSearch]);

  return {
    analyses,
    total,
    totalPages,
    page,
    pageSize,
    filters,
    debouncedSearch,
    activeFiltersCount,
    setFilters,
    setSearch,
    resetFilters,
    setPage,
    loading,
    isFetching,
    error,
    hasNoData,
    hasNoResults,
    saving,
    saveError,
    metrics,
    metricsLoading,
    predios,
    lotes,
    laboratorios,
    years,
    parametros,
    prediosLoading,
    lotesLoading,
    labsLoading,
    refetch,
    fetchMetrics,
    createAnalisis,
    updateAnalisis,
    deleteAnalisis,
    archiveAnalisis,
  };
}

/**
 * Hook para detalle de un análisis (drawer)
 */
export function useSoilAnalysisDetail(analysisId) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await soilAnalysisService.getAnalysisById(id);
      setDetail(d);
    } catch (err) {
      setError(err?.message || 'Error al cargar detalle.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetail(analysisId);
  }, [analysisId, fetchDetail]);

  return { detail, loading, error, refetch: () => fetchDetail(analysisId), setDetail };
}

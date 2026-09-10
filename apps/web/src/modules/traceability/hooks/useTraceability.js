import { useState, useEffect, useCallback, useMemo } from 'react';
import { traceabilityService } from '../services/traceability.service';

/**
 * useTraceability — estado del timeline de evidencia por lote.
 * Filtros: lote, rango fechas, tipo actividad, responsable, búsqueda.
 */
export function useTraceability(initialFilters = {}) {
  const [filters, setFilters] = useState({
    lote_id: '', desde: '', hasta: '', event_type: 'todas',
    source_module: 'todas', responsable: '', search: '', page: 1, limit: 20,
    ...initialFilters
  });
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chain, setChain] = useState(null);
  const [summary, setSummary] = useState(null);

  const query = useMemo(() => {
    const q = { ...filters };
    if (q.event_type === 'todas') delete q.event_type;
    if (q.source_module === 'todas') delete q.source_module;
    Object.keys(q).forEach((k) => { if (q[k] === '' || q[k] == null) delete q[k]; });
    return q;
  }, [filters]);

  const fetchEvents = useCallback(async (append = false) => {
    if (!filters.lote_id) { setEvents([]); setPagination({ total: 0, page: 1, limit: 20, totalPages: 1 }); return; }
    setLoading(true); setError(null);
    try {
      const res = await traceabilityService.listEvents(query);
      setEvents((prev) => (append ? [...prev, ...(res.data || [])] : (res.data || [])));
      setPagination({ total: res.total, page: res.page, limit: res.limit, totalPages: res.totalPages });
    } catch (e) {
      setError(e);
      if (!append) setEvents([]);
    } finally { setLoading(false); }
  }, [query, filters.lote_id]);

  useEffect(() => { fetchEvents(false); }, [fetchEvents]);

  const loadMore = useCallback(() => {
    if (pagination.page >= pagination.totalPages || loading) return;
    setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }));
    // El efecto refetchea; para anexar, el caller usa append manualmente:
  }, [pagination, loading]);

  // Anexado real: cuando page aumenta, anexar en vez de reemplazar.
  useEffect(() => {
    if ((filters.page || 1) <= 1) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await traceabilityService.listEvents(query);
        if (cancelled) return;
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          return [...prev, ...(res.data || []).filter((e) => !seen.has(e.id))];
        });
        setPagination({ total: res.total, page: res.page, limit: res.limit, totalPages: res.totalPages });
      } catch (e) { if (!cancelled) setError(e); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page]);

  const selectEvent = useCallback(async (ev) => {
    setSelected(ev);
    if (!ev) { setDetail(null); return; }
    // Si el evento ya trae detalle completo, usarlo de inmediato.
    if (ev.metadata && ev.event_hash !== undefined) setDetail(ev);
    setDetailLoading(true);
    try {
      const full = await traceabilityService.getEvent(ev.id);
      if (full) { setDetail(full); setSelected(full); }
    } catch { /* conserva el evento base del timeline */ }
    finally { setDetailLoading(false); }
  }, []);

  const refreshIntegrity = useCallback(async () => {
    if (!filters.lote_id) return;
    try {
      const [c, s] = await Promise.all([
        traceabilityService.verifyChain(filters.lote_id).catch(() => null),
        traceabilityService.lotSummary(filters.lote_id).catch(() => null)
      ]);
      setChain(c); setSummary(s);
    } catch { /* best-effort */ }
  }, [filters.lote_id]);

  useEffect(() => { refreshIntegrity(); }, [refreshIntegrity, events.length]);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }, []);

  const resetPage = useCallback(() => setFilters((f) => ({ ...f, page: 1 })), []);

  return {
    filters, setFilters, setFilter, resetPage,
    events, pagination, loading, error,
    selected, detail, detailLoading, selectEvent,
    chain, summary, refresh: () => fetchEvents(false), loadMore, refreshIntegrity
  };
}

export default useTraceability;

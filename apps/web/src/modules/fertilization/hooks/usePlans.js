/**
 * usePlans.js
 * Custom hook para el submódulo "Planes de Fertilización".
 *
 * Responsabilidad exclusiva: administrar estado UI.
 *   - filters, pagination, loading, error, plans
 *   - Handlers de usuario (create, edit, duplicate, delete, archive)
 *
 * NO contiene: lógica de filtrado, consultas, transformaciones.
 *   → Toda lógica de datos vive en plansService (service) y
 *     fertilizationRepository (repository).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { plansService } from '../services/fertilization.service.js';

const DEFAULT_FILTERS = {
  search:        '',
  status:        '',
  validityStatus:'',
  cropId:        '',
  farmId:        '',
  lotId:         '',
  dateFrom:      '',
  dateTo:        '',
};

const DEFAULT_PAGE_SIZE = 5;

/**
 * @returns {{
 *   plans: object[],
 *   total: number,
 *   totalPages: number,
 *   page: number,
 *   pageSize: number,
 *   loading: boolean,
 *   error: string|null,
 *   filters: object,
 *   setFilters: function,
 *   setPage: function,
 *   resetFilters: function,
 *   handleCreate: function,
 *   handleEdit: function,
 *   handleDuplicate: function,
 *   handleDelete: function,
 *   handleArchive: function,
 *   refetch: function,
 * }}
 */
export function usePlans() {
  // ── Estado de datos ──────────────────────────────────────────────────────────
  const [plans, setPlans]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Estado de UI ─────────────────────────────────────────────────────────────
  const [page, setPage]             = useState(1);
  const [filters, setFiltersState]  = useState(DEFAULT_FILTERS);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // Ref para cancelar requests desactualizados (evita race conditions)
  const abortRef = useRef(false);

  // ── Fetch centralizado ───────────────────────────────────────────────────────
  const fetchPlans = useCallback(async (currentFilters, currentPage) => {
    abortRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const result = await plansService.getPlans({
        ...currentFilters,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });
      if (abortRef.current) return; // Request desactualizado
      setPlans(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (!abortRef.current) {
        setError(err?.message ?? 'Error al cargar los planes de fertilización');
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, []);

  // ── Efecto: re-fetch cuando cambian filtros o página ─────────────────────────
  useEffect(() => {
    fetchPlans(filters, page);
    return () => { abortRef.current = true; }; // cleanup
  }, [fetchPlans, filters, page]);

  // ── Acciones de filtros ──────────────────────────────────────────────────────
  /** Aplica nuevos filtros y resetea a página 1 */
  const setFilters = useCallback((newFilters) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  // ── Refetch manual (botón Reintentar) ────────────────────────────────────────
  const refetch = useCallback(() => {
    fetchPlans(filters, page);
  }, [fetchPlans, filters, page]);

  // ── Handlers CRUD ───────────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    // TODO: abrir modal/drawer de creación
    console.info('[Fertilización] Crear nuevo plan de fertilización');
  }, []);

  const handleEdit = useCallback((plan) => {
    // TODO: abrir modal/drawer de edición con el plan seleccionado
    console.info('[Fertilización] Editar plan:', plan.id, plan.version);
  }, []);

  const handleDuplicate = useCallback(
    async (plan) => {
      try {
        await plansService.createNewVersion(plan.id);
        fetchPlans(filters, page);
      } catch (err) {
        console.error('[Fertilización] Error al duplicar plan:', err);
      }
    },
    [fetchPlans, filters, page],
  );

  const handleDelete = useCallback(
    async (plan) => {
      if (!window.confirm(`¿Eliminar el plan "${plan.name}"? Esta acción no se puede deshacer.`))
        return;
      try {
        await plansService.deletePlan(plan.id);
        fetchPlans(filters, page);
      } catch (err) {
        console.error('[Fertilización] Error al eliminar plan:', err);
      }
    },
    [fetchPlans, filters, page],
  );

  const handleArchive = useCallback(
    async (plan) => {
      try {
        await plansService.archivePlan(plan.id);
        fetchPlans(filters, page);
      } catch (err) {
        console.error('[Fertilización] Error al archivar plan:', err);
      }
    },
    [fetchPlans, filters, page],
  );

  const handleView = useCallback((plan) => {
    // TODO: navegar a detalle del plan
    console.info('[Fertilización] Ver detalle plan:', plan.id, plan.code);
  }, []);

  const handleScheduleApps = useCallback((plan) => {
    console.info('[Fertilización] Programar aplicaciones:', plan.id);
  }, []);

  const handleGenerateRecs = useCallback((plan) => {
    console.info('[Fertilización] Generar recomendaciones:', plan.id);
  }, []);

  const handleViewHistory = useCallback((plan) => {
    console.info('[Fertilización] Historial & versiones:', plan.id);
  }, []);

  const handleExportPdf = useCallback((plan) => {
    console.info('[Fertilización] Exportar PDF:', plan.id);
  }, []);

  const handleExportExcel = useCallback((plan) => {
    console.info('[Fertilización] Exportar Excel:', plan.id);
  }, []);

  return {
    // Estado de datos
    plans,
    total,
    totalPages,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    loading,
    error,
    // Filtros
    filters,
    setFilters,
    setPage,
    resetFilters,
    // Handlers
    refetch,
    handleCreate,
    handleView,
    handleEdit,
    handleDuplicate,
    handleDelete,
    handleArchive,
    handleScheduleApps,
    handleGenerateRecs,
    handleViewHistory,
    handleExportPdf,
    handleExportExcel,
  };
}

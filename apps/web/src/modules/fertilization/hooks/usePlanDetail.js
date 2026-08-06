/**
 * usePlanDetail.js
 * Hook principal para la pantalla de detalle del plan de fertilización.
 *
 * Sigue el mismo patrón de usePlans.js: useState/useEffect/useCallback.
 * No usa TanStack Query para mantener consistencia con el módulo existente.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getFertilizationPlan,
  updateFertilizationPlan,
  saveObservation,
  addComment,
  completeApplication,
  exportPlanPdf,
} from '../api/plan-detail.api.js';

/**
 * @param {string} planId - UUID del plan
 * @returns {{
 *   detail: Object|null,
 *   loading: boolean,
 *   error: string|null,
 *   mutating: boolean,
 *   refetch: function,
 *   handleSaveObservation: function,
 *   handleAddComment: function,
 *   handleCompleteApplication: function,
 *   handleExportPdf: function,
 *   handleUpdatePlan: function,
 *   toast: { message: string, type: string }|null,
 *   clearToast: function,
 * }}
 */
export function usePlanDetail(planId) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast]     = useState(null);

  // ── Fetch del plan ──────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFertilizationPlan(planId);
      setDetail(data);
    } catch (err) {
      setError(err?.message ?? 'Error al cargar el plan de fertilización');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getFertilizationPlan(planId);
        if (!isCancelled) setDetail(data);
      } catch (err) {
        if (!isCancelled) setError(err?.message ?? 'Error al cargar el plan de fertilización');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };
    load();
    return () => {
      isCancelled = true;
    };
  }, [planId]);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  // ── Handler: Guardar observación ────────────────────────────────────────────
  const handleSaveObservation = useCallback(async (payload) => {
    setMutating(true);
    try {
      await saveObservation(planId, payload);
      showToast('Observación registrada correctamente');
      await fetchDetail(); // Recargar detalle para reflejar cambios
    } catch (err) {
      showToast(err?.message || 'Error registrando la observación', 'error');
      throw err; // Re-lanzar para que el Drawer pueda resetear su estado
    } finally {
      setMutating(false);
    }
  }, [planId, fetchDetail, showToast]);

  // ── Handler: Añadir comentario ──────────────────────────────────────────────
  const handleAddComment = useCallback(async (observationId, content) => {
    setMutating(true);
    try {
      await addComment(observationId, content);
      showToast('Comentario añadido');
      await fetchDetail();
    } catch (err) {
      showToast(err?.message || 'Error añadiendo el comentario', 'error');
      throw err;
    } finally {
      setMutating(false);
    }
  }, [fetchDetail, showToast]);

  // ── Handler: Completar aplicación ───────────────────────────────────────────
  const handleCompleteApplication = useCallback(async (applicationId, completionData = {}) => {
    setMutating(true);
    try {
      await completeApplication(applicationId, completionData);
      showToast('Aplicación marcada como realizada');
      // Optimistic update: actualizar localmente mientras se recarga
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          applications: prev.applications.map(a =>
            a.id === applicationId
              ? { ...a, status: 'completed', completed_date: new Date().toISOString().split('T')[0] }
              : a
          ),
          plan: {
            ...prev.plan,
            applicationsCompleted: (prev.plan.applicationsCompleted || 0) + 1,
          },
        };
      });
      await fetchDetail();
    } catch (err) {
      showToast(err?.message || 'Error completando la aplicación', 'error');
    } finally {
      setMutating(false);
    }
  }, [fetchDetail, showToast]);

  // ── Handler: Exportar PDF ───────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    setMutating(true);
    try {
      await exportPlanPdf(planId);
      showToast('Documento generado correctamente');
    } catch (err) {
      showToast(err?.message || 'Error exportando el documento', 'error');
    } finally {
      setMutating(false);
    }
  }, [planId, showToast]);

  // ── Handler: Actualizar plan ────────────────────────────────────────────────
  const handleUpdatePlan = useCallback(async (data) => {
    setMutating(true);
    try {
      await updateFertilizationPlan(planId, data);
      showToast('Plan actualizado correctamente');
      await fetchDetail();
    } catch (err) {
      showToast(err?.message || 'Error actualizando el plan', 'error');
      throw err;
    } finally {
      setMutating(false);
    }
  }, [planId, fetchDetail, showToast]);

  return {
    detail,
    loading,
    error,
    mutating,
    refetch:                  fetchDetail,
    handleSaveObservation,
    handleAddComment,
    handleCompleteApplication,
    handleExportPdf,
    handleUpdatePlan,
    toast,
    clearToast,
  };
}

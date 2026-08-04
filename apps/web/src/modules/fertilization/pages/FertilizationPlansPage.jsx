/**
 * FertilizationPlansPage.jsx  ·  pages/
 * Vista completa del submódulo "Planes de Fertilización".
 *
 * Orquesta:
 *   1. PlanFilters   — barra de búsqueda + filtros
 *   2. PlansDataTable — tabla principal (loading/error/empty/data)
 *   3. Pagination    — controles de página
 *
 * Consume usePlans() exclusivamente — no contiene lógica de datos.
 */
import React from 'react';
import { usePlans } from '../hooks/usePlans.js';
import PlanFilters from '../components/plans/PlanFilters.jsx';
import PlansDataTable from '../components/plans/PlansDataTable.jsx';
import Pagination from '../components/plans/Pagination.jsx';

export default function FertilizationPlansPage() {
  const {
    plans,
    total,
    totalPages,
    page,
    pageSize,
    loading,
    error,
    filters,
    setFilters,
    setPage,
    resetFilters,
    refetch,
    // Handlers para las acciones
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
  } = usePlans();

  // Mapa de handlers que consume PlansDataTable → PlanRow → ActionsDropdown
  const handlers = {
    onCreatePlan:    handleCreate,
    onView:          handleView,
    onEdit:          handleEdit,
    onDuplicate:     handleDuplicate,
    onDelete:        handleDelete,
    onArchive:       handleArchive,
    onScheduleApps:  handleScheduleApps,
    onGenerateRecs:  handleGenerateRecs,
    onViewHistory:   handleViewHistory,
    onExportPdf:     handleExportPdf,
    onExportExcel:   handleExportExcel,
  };

  return (
    <div
      className="plans-page"
      id="fert-tabpanel-planes"
      role="tabpanel"
      aria-labelledby="fert-tab-planes"
    >
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <PlanFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={resetFilters}
      />

      {/* ── Tabla ────────────────────────────────────────────────────────── */}
      <div className="plans-table-card fert-card fert-card--static">
        <PlansDataTable
          plans={plans}
          loading={loading}
          error={error}
          handlers={handlers}
        />

        {/* ── Paginación (dentro de la card, debajo de la tabla) ─────────── */}
        {!loading && !error && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

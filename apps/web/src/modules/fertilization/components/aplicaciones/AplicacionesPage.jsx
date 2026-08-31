import { memo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAplicaciones } from '../../hooks/useAplicaciones.js';
import AplicacionesSummary from './AplicacionesSummary.jsx';
import AplicacionesToolbar from './AplicacionesToolbar.jsx';
import AplicacionesTable from './AplicacionesTable.jsx';
import AplicacionesPagination from './AplicacionesPagination.jsx';
import AplicacionesGuide from './AplicacionesGuide.jsx';
import ApplicationDetailDrawer from './ApplicationDetailDrawer.jsx';
import NuevaAplicacionDrawer from './NuevaAplicacionDrawer.jsx';

/**
 * AplicacionesPage — Página completa del submódulo Aplicaciones.
 * Orquesta: Summary + Toolbar + Table + Pagination + Guide + Drawer
 * Mantiene separación: service → hook → UI, cero mocks.
 */
function AplicacionesPage({ onNewAplicacion, onViewGuide, externalOpenTrigger = 0 }) {
  const {
    aplicaciones,
    total,
    totalPages,
    page,
    pageSize,
    filters,
    activeFiltersCount,
    setFilters,
    resetFilters,
    setPage,
    loading,
    isFetching,
    error,
    hasNoData,
    hasNoResults,
    stats,
    statsLoading,
    lotes,
    lotesLoading,
    refetch,
    deleteAplicacion,
  } = useAplicaciones();

  const [detailApp, setDetailApp] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  // Apertura externa desde header (comunicación Dashboard → Página)
  useEffect(() => {
    if (externalOpenTrigger > 0) setNewOpen(true);
  }, [externalOpenTrigger]);

  const handleAction = useCallback((key, app) => {
    switch (key) {
      case 'view':
        setDetailApp(app);
        setDrawerOpen(true);
        break;
      case 'edit':
        console.info('[Aplicaciones] Editar:', app.id);
        break;
      case 'register':
        setNewOpen(true);
        onNewAplicacion?.(app);
        break;
      case 'recommendation':
        console.info('[Aplicaciones] Ver recomendación:', app.planId);
        break;
      case 'delete':
        if (window.confirm(`¿Eliminar la aplicación del ${app.fechaFormatted}? Esta acción respeta RLS por empresa.`)) {
          deleteAplicacion(app.id).catch((e) => alert(e.message));
        }
        break;
      default:
        break;
    }
  }, [onNewAplicacion, deleteAplicacion]);

  const handleNew = useCallback(() => {
    setNewOpen(true);
    onNewAplicacion?.();
  }, [onNewAplicacion]);

  const handleViewGuide = useCallback(() => {
    if (onViewGuide) onViewGuide();
    else console.info('[Aplicaciones] Ver guía');
  }, [onViewGuide]);

  return (
    <motion.div
      className="aplicaciones-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="region"
      aria-label="Aplicaciones de fertilización"
    >
      {/* Summary */}
      <AplicacionesSummary stats={stats} statsLoading={statsLoading} />

      {/* Card contenedora de toolbar + tabla + paginación */}
      <div className="fert-card fert-card--static app-main-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '16px 20px 0 20px' }}>
          <AplicacionesToolbar
            filters={filters}
            lotes={lotes}
            lotesLoading={lotesLoading}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            activeFiltersCount={activeFiltersCount}
          />
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--fert-border)' }}>
          <AplicacionesTable
            aplicaciones={aplicaciones}
            loading={loading}
            isFetching={isFetching}
            error={error}
            hasNoData={hasNoData}
            hasNoResults={hasNoResults}
            onAction={handleAction}
            onRetry={refetch}
            onClearFilters={resetFilters}
            onNewAplicacion={handleNew}
          />
        </div>

        {!loading && !error && total > 0 && (
          <AplicacionesPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Guía inferior */}
      <AplicacionesGuide onViewGuide={handleViewGuide} />

      {/* Drawer detalle */}
      <ApplicationDetailDrawer aplicacion={detailApp} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Drawer nueva aplicación — guardado real por usuario/empresa */}
      <NuevaAplicacionDrawer
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => refetch()}
      />
    </motion.div>
  );
}

export default memo(AplicacionesPage);

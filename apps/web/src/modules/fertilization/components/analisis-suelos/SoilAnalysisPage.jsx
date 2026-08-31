import { memo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, FlaskConical } from 'lucide-react';
import { useSoilAnalysis, useSoilAnalysisDetail } from '../../hooks/useSoilAnalysis.js';
import SoilMetrics from './SoilMetrics.jsx';
import SoilFilters from './SoilFilters.jsx';
import SoilTable from './SoilTable.jsx';
import SoilPagination from './SoilPagination.jsx';
import SoilDetailDrawer from './SoilDetailDrawer.jsx';
import SoilFormDrawer from './SoilFormDrawer.jsx';
import SoilPdfViewer from './SoilPdfViewer.jsx';
import SoilMap from './SoilMap.jsx';
import { soilAnalysisStorageService } from '../../services/soilAnalysisStorage.service.js';
import { geolocationService } from '../../services/geolocation.service.js';
import '../../styles/soilAnalysis.css';

/**
 * SoilAnalysisPage — Página completa del submódulo Análisis de Suelos
 * Orquesta: Metrics + Filters + Table + Pagination + Drawer + Form + PDF Viewer + Mapa
 * Cero mocks — todo vía Supabase con RLS + aislamiento empresa/predio
 */
function SoilAnalysisPage({ externalOpenTrigger = 0 }) {
  const {
    analyses,
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
    deleteAnalisis,
    archiveAnalisis,
  } = useSoilAnalysis();

  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { detail, loading: detailLoading, refetch: refetchDetail } = useSoilAnalysisDetail(selected?.id || null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfTarget, setPdfTarget] = useState(null);

  const [mapModal, setMapModal] = useState(null);

  // Apertura externa desde header (Dashboard → + Nuevo Análisis)
  useEffect(() => {
    if (externalOpenTrigger > 0) {
      setEditing(null);
      setFormOpen(true);
    }
  }, [externalOpenTrigger]);

  const handleAction = useCallback(async (key, analisis) => {
    switch (key) {
      case 'view':
        setSelected(analisis);
        setDrawerOpen(true);
        break;
      case 'edit':
        setEditing(analisis);
        setFormOpen(true);
        break;
      case 'viewPdf':
        if (analisis.archivoPath) {
          setPdfTarget({ path: analisis.archivoPath, name: analisis.archivoNombre || 'Informe.pdf' });
          setPdfViewerOpen(true);
        } else {
          alert('Este análisis no tiene PDF adjunto.');
        }
        break;
      case 'downloadPdf':
        if (analisis.archivoPath) {
          try {
            await soilAnalysisStorageService.downloadPdf(analisis.archivoPath, analisis.archivoNombre || 'informe.pdf');
          } catch (e) {
            alert(e.message);
          }
        }
        break;
      case 'viewLocation':
        setMapModal(analisis);
        break;
      case 'duplicate': {
        // Duplicar información sin PDF ni GPS opcionalmente — crea borrador
        const dup = { ...analisis };
        // Usar form con datos copiados pero sin file
        setEditing({
          ...dup,
          id: null,
          codigoMuestra: dup.codigoMuestra ? `${dup.codigoMuestra}-COPIA` : '',
          nombreMuestra: dup.nombreMuestra ? `${dup.nombreMuestra} (copia)` : '',
          archivoPath: null,
          archivoNombre: null,
          hasPdf: false,
        });
        setFormOpen(true);
        break;
      }
      case 'archive':
        if (window.confirm(`¿Archivar el análisis del ${analisis.fechaAnalisisFormatted} — ${analisis.loteNombre}? Podrá restaurarse después.`)) {
          try {
            await archiveAnalisis(analisis.id);
          } catch (e) {
            alert(e.message);
          }
        }
        break;
      case 'delete':
        if (window.confirm(`¿Eliminar/anular el análisis ${analisis.codigoMuestra || analisis.loteNombre}? Esta acción respeta RLS por empresa.`)) {
          try {
            await deleteAnalisis(analisis.id);
            if (selected?.id === analisis.id) {
              setDrawerOpen(false);
              setSelected(null);
            }
          } catch (e) {
            alert(e.message);
          }
        }
        break;
      default:
        break;
    }
  }, [archiveAnalisis, deleteAnalisis, selected?.id]);

  const handleNew = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEditFromDrawer = useCallback(() => {
    if (selected) {
      setEditing(selected);
      setFormOpen(true);
    }
  }, [selected]);

  const handleFormCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <motion.div
      className="soil-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="region"
      aria-label="Análisis de Suelos"
    >
      {/* Métricas */}
      <SoilMetrics metrics={metrics} loading={metricsLoading} />

      {/* Card contenedora */}
      <div className="fert-card fert-card--static soil-main-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '16px 20px 0 20px' }}>
          <SoilFilters
            filters={filters}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            activeFiltersCount={activeFiltersCount}
            predios={predios}
            lotes={lotes}
            laboratorios={laboratorios}
            years={years}
            prediosLoading={prediosLoading}
            lotesLoading={lotesLoading}
            labsLoading={labsLoading}
          />
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--fert-border)' }}>
          <SoilTable
            analyses={analyses}
            loading={loading}
            isFetching={isFetching}
            error={error}
            hasNoData={hasNoData}
            hasNoResults={hasNoResults}
            selectedId={selected?.id || null}
            onAction={handleAction}
            onRetry={refetch}
            onClearFilters={resetFilters}
            onNew={handleNew}
          />
        </div>

        {!loading && !error && total > 0 && (
          <SoilPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Guía inferior */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px',
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: 12
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#FFFFFF', border: '1px solid #BFDBFE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#059669', flexShrink: 0
        }}>
          <FlaskConical size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>Repositorio agronómico estructurado</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            Cada análisis alimenta la Calculadora de Fertilización. Mantén borradores para completar resultados luego y archiva históricos sin perder trazabilidad.
          </div>
        </div>
        <button
          type="button"
          className="fert-btn fert-btn--outline"
          style={{ fontSize: 12, whiteSpace: 'nowrap' }}
          onClick={() => window.alert('Guía: registra laboratorio → muestrea → carga PDF → digita parámetros → usa en calculadora.')}
        >
          Ver guía
        </button>
      </div>

      {/* Drawer detalle */}
      <SoilDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        analisis={selected}
        detail={detail}
        detailLoading={detailLoading}
      />

      {/* Form drawer (crear/editar) */}
      <SoilFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={handleFormCreated}
        onUpdated={() => { refetch(); if (selected) refetchDetail(); }}
        editing={editing}
        predios={predios}
        lotes={lotes}
        laboratorios={laboratorios}
        parametros={parametros}
        prediosLoading={prediosLoading}
        lotesLoading={lotesLoading}
        labsLoading={labsLoading}
      />

      {/* PDF Viewer global */}
      <SoilPdfViewer
        open={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        pdfPath={pdfTarget?.path}
        fileName={pdfTarget?.name}
      />

      {/* Mapa modal simple */}
      {mapModal && (
        <div
          className="soil-pdf-backdrop"
          onClick={() => setMapModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Ubicación del muestreo"
        >
          <div
            className="soil-pdf-modal"
            style={{ width: 460, height: 'auto', maxHeight: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="soil-pdf-modal__header" style={{ padding: '16px 20px' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Ubicación de muestreo</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{mapModal.loteNombre} · {mapModal.predioNombre}</div>
              </div>
              <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={() => setMapModal(null)}>
                ×
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <SoilMap
                latitude={mapModal.latitude}
                longitude={mapModal.longitude}
                accuracyM={mapModal.accuracyM}
                ubicacionNombre={mapModal.ubicacionNombre || mapModal.zonaMuestreo}
                ubicacionDescripcion={mapModal.ubicacionDescripcion || mapModal.predioNombre}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {mapModal.latitude != null && mapModal.longitude != null && (
                  <a
                    href={geolocationService.getOsmUrl(mapModal.latitude, mapModal.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fert-btn fert-btn--outline"
                    style={{ fontSize: 12 }}
                  >
                    Abrir en OSM
                  </a>
                )}
                <button type="button" className="fert-btn fert-btn--ghost" onClick={() => setMapModal(null)} style={{ fontSize: 12 }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(SoilAnalysisPage);

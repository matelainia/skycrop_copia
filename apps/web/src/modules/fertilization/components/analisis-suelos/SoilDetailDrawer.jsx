import { memo, useState } from 'react';
import { X, FlaskConical, FileText, MapPin, Download, Eye, ExternalLink } from 'lucide-react';
import { formatFileSize } from '../../utils/formatSoilAnalysis.js';
import SoilMap from './SoilMap.jsx';
import { soilAnalysisStorageService } from '../../services/soilAnalysisStorage.service.js';
import SoilPdfViewer from './SoilPdfViewer.jsx';

const LEVEL_LABELS = {
  muy_bajo: 'Muy bajo',
  bajo: 'Bajo',
  medio: 'Medio',
  moderado: 'Moderado',
  optimo: 'Óptimo',
  alto: 'Alto',
  muy_alto: 'Muy alto',
};

function LevelBadge({ nivel }) {
  if (!nivel) return null;
  const key = String(nivel).toLowerCase();
  const label = LEVEL_LABELS[key] || nivel;
  const cls = {
    muy_bajo: 'soil-result-tile__level--bajo',
    bajo: 'soil-result-tile__level--bajo',
    medio: 'soil-result-tile__level--medio',
    moderado: 'soil-result-tile__level--medio',
    optimo: 'soil-result-tile__level--optimo',
    alto: 'soil-result-tile__level--alto',
    muy_alto: 'soil-result-tile__level--muy_alto',
  }[key] || '';
  return <div className={`soil-result-tile__level ${cls}`}>{label}</div>;
}

const SoilDetailDrawer = memo(function SoilDetailDrawer({ open, onClose, analisis, detail, detailLoading }) {
  const [pdfOpen, setPdfOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!open || !analisis) return null;

  const resultados = detail?.resultados || [];

  const handleDownload = async () => {
    if (!analisis.archivoPath) return;
    setDownloading(true);
    try {
      await soilAnalysisStorageService.downloadPdf(analisis.archivoPath, analisis.archivoNombre || 'analisis.pdf');
    } catch (e) {
      alert(e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="soil-drawer-backdrop" onClick={onClose} aria-hidden="true">
        <aside
          className="soil-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle del análisis ${analisis.loteNombre}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="soil-drawer__header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#6B7280' }}>{analisis.fechaAnalisisFormatted}</span>
                <span className={`soil-badge soil-badge--${analisis.estadoVariant}`}>{analisis.estadoLabel}</span>
              </div>
              <div className="soil-drawer__title" style={{ marginTop: 6 }}>{analisis.loteNombre} — {analisis.cultivo && analisis.cultivo !== '—' ? analisis.cultivo : 'Cacao'}</div>
              <div className="soil-drawer__subtitle">{analisis.zonaMuestreo || analisis.ubicacionNombre || 'Área productiva'} {analisis.predioNombre !== '—' ? `· ${analisis.predioNombre}` : ''}</div>
            </div>
            <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={onClose} aria-label="Cerrar detalle">
              <X size={18} />
            </button>
          </div>

          <div className="soil-drawer__body">
            {/* Información general */}
            <section>
              <div className="soil-drawer__section-title">Información general</div>
              <div className="soil-drawer__info-grid">
                <div>
                  <div className="soil-drawer__info-label">Laboratorio</div>
                  <div className="soil-drawer__info-value">{analisis.laboratorioNombre}</div>
                  {analisis.laboratorioCert && <div style={{ fontSize: 11, color: '#6B7280' }}>Cert. {analisis.laboratorioCert}</div>}
                </div>
                <div>
                  <div className="soil-drawer__info-label">Certificado</div>
                  <div className="soil-drawer__info-value">{analisis.laboratorioCert || '—'}</div>
                </div>
                <div>
                  <div className="soil-drawer__info-label">Fecha de recepción</div>
                  <div className="soil-drawer__info-value">{analisis.fechaRecepcionFormatted}</div>
                </div>
                <div>
                  <div className="soil-drawer__info-label">Fecha de análisis</div>
                  <div className="soil-drawer__info-value">{analisis.fechaAnalisisFormatted}</div>
                </div>
                <div>
                  <div className="soil-drawer__info-label">Muestreado por</div>
                  <div className="soil-drawer__info-value">{analisis.muestreador || '—'}</div>
                </div>
                <div>
                  <div className="soil-drawer__info-label">Método de muestreo</div>
                  <div className="soil-drawer__info-value">{analisis.metodoMuestreoLabel}</div>
                </div>
                <div>
                  <div className="soil-drawer__info-label">Profundidad</div>
                  <div className="soil-drawer__info-value">{analisis.profundidadLabel}</div>
                </div>
                <div>
                  <div className="soil-drawer__info-label">Observaciones</div>
                  <div className="soil-drawer__info-value" style={{ fontSize: 12 }}>{analisis.observaciones || 'Sin observaciones'}</div>
                </div>
              </div>
              {(analisis.codigoMuestra || analisis.nombreMuestra) && (
                <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {analisis.codigoMuestra && <span className="soil-param-pill">Código: {analisis.codigoMuestra}</span>}
                  {analisis.nombreMuestra && <span className="soil-param-pill">{analisis.nombreMuestra}</span>}
                </div>
              )}
            </section>

            {/* Documento */}
            <section>
              <div className="soil-drawer__section-title">Documento del análisis</div>
              {analisis.hasPdf ? (
                <div className="soil-doc-card">
                  <div className="soil-doc-card__icon">PDF</div>
                  <div className="soil-doc-card__meta">
                    <div className="soil-doc-card__name" title={analisis.archivoNombre}>{analisis.archivoNombre}</div>
                    <div className="soil-doc-card__size">{formatFileSize(analisis.archivoSize)} · PDF</div>
                  </div>
                  <div className="soil-doc-actions">
                    <button type="button" className="fert-btn fert-btn--outline" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setPdfOpen(true)}>
                      <Eye size={14} /> Ver documento
                    </button>
                    <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={handleDownload} aria-label="Descargar PDF" disabled={downloading}>
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, borderRadius: 12, border: '1px dashed #E5E7EB', background: '#F9FAFB', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                  <FileText size={18} style={{ margin: '0 auto 6px', opacity: 0.6 }} />
                  Sin documento PDF adjunto
                </div>
              )}
            </section>

            {/* Resumen de resultados */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="soil-drawer__section-title" style={{ marginBottom: 0 }}>Resumen de resultados</div>
                {!detailLoading && resultados.length > 6 && (
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{resultados.length} parámetros</span>
                )}
              </div>

              {detailLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="soil-skeleton" style={{ height: 84, borderRadius: 12 }} />
                  ))}
                </div>
              ) : resultados.length > 0 ? (
                <>
                  <div className="soil-results-grid">
                    {resultados.slice(0, 6).map((r) => (
                      <div key={r.id || r.codigo} className="soil-result-tile">
                        <div className="soil-result-tile__label">{r.codigo}</div>
                        <div className="soil-result-tile__value">{Number(r.valor).toFixed(r.codigo === 'pH' ? 1 : 2)}</div>
                        <div className="soil-result-tile__unit">{r.unidad}</div>
                        <LevelBadge nivel={r.nivel} />
                      </div>
                    ))}
                  </div>
                  {resultados.length > 6 && (
                    <button
                      type="button"
                      className="fert-btn fert-btn--ghost"
                      style={{ width: '100%', marginTop: 12, justifyContent: 'center', fontSize: 13, color: '#059669' }}
                      onClick={() => {/* expandir: se muestra todo */}}
                    >
                      Ver todos los resultados ({resultados.length})
                    </button>
                  )}
                  {/* Lista completa expandible simple */}
                  {resultados.length > 6 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {resultados.slice(6).map((r) => (
                        <div key={r.id || r.codigo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{r.codigo} <span style={{ color: '#6B7280', fontWeight: 400 }}>{r.unidad}</span></span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong>{Number(r.valor).toFixed(2)}</strong>
                            <LevelBadge nivel={r.nivel} />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: 16, borderRadius: 12, border: '1px dashed #E5E7EB', background: '#F9FAFB', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                  <FlaskConical size={18} style={{ margin: '0 auto 6px', opacity: 0.6 }} />
                  Sin resultados analíticos registrados
                </div>
              )}
            </section>

            {/* Ubicación */}
            <section>
              <div className="soil-drawer__section-title">Ubicación de muestreo (opcional)</div>
              <SoilMap
                latitude={analisis.latitude}
                longitude={analisis.longitude}
                accuracyM={analisis.accuracyM}
                ubicacionNombre={analisis.ubicacionNombre || analisis.zonaMuestreo}
                ubicacionDescripcion={analisis.ubicacionDescripcion || analisis.predioNombre}
              />
              {analisis.hasGps && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, fontSize: 11, color: '#6B7280' }}>
                  <span>Lat: {Number(analisis.latitude).toFixed(6)}</span>
                  <span>Lon: {Number(analisis.longitude).toFixed(6)}</span>
                  {analisis.accuracyM != null && <span>Precisión {analisis.accuracyM.toFixed(0)} m</span>}
                </div>
              )}
            </section>

            {/* Integración futura */}
            <section style={{ padding: 12, borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF' }}>Integración con Fertilización</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                Utiliza estos resultados como entrada de la Calculadora de Fertilización para generar requerimientos y recomendaciones nutricionales sin re-digitar valores.
              </div>
              <button
                type="button"
                className="fert-btn fert-btn--outline"
                style={{ marginTop: 10, fontSize: 12, padding: '6px 10px' }}
                onClick={() => alert('Próximamente: usar este análisis en la Calculadora')}
              >
                <ExternalLink size={12} /> Usar en Calculadora
              </button>
            </section>
          </div>
        </aside>
      </div>

      {/* PDF Viewer */}
      <SoilPdfViewer
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        pdfPath={analisis.archivoPath}
        fileName={analisis.archivoNombre || 'Informe.pdf'}
      />
    </>
  );
});

export default SoilDetailDrawer;

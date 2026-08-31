import { memo, useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { soilAnalysisStorageService } from '../../services/soilAnalysisStorage.service.js';

const SoilPdfViewer = memo(function SoilPdfViewer({ open, onClose, pdfPath, fileName = 'Informe.pdf' }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!open || !pdfPath) {
      setSignedUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = await soilAnalysisStorageService.getSignedUrl(pdfPath, 600);
        if (!cancelled) setSignedUrl(url);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, pdfPath]);

  if (!open) return null;

  return (
    <div className="soil-pdf-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Visor de PDF">
      <div className="soil-pdf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="soil-pdf-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800 }}>PDF</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Informe de análisis · URL válida 10 min</div>
            </div>
          </div>
          <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={onClose} aria-label="Cerrar visor">
            <X size={18} />
          </button>
        </div>

        <div className="soil-pdf-modal__body">
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#6B7280' }}>
              <Loader2 size={28} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Cargando documento...</span>
            </div>
          )}
          {error && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#DC2626', padding: 24, textAlign: 'center' }}>
              <AlertTriangle size={28} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No fue posible cargar el documento</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{error}</div>
              <button type="button" className="fert-btn fert-btn--outline" onClick={onClose}>Cerrar</button>
            </div>
          )}
          {!loading && !error && signedUrl && (
            <iframe
              src={signedUrl}
              title={fileName}
              style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
              allow="fullscreen"
            />
          )}
        </div>

        <div className="soil-pdf-modal__footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Alejar">
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: 12, color: '#6B7280', minWidth: 44, textAlign: 'center' }}>{zoom}%</span>
            <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Acercar">
              <ZoomIn size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="fert-btn fert-btn--outline"
                style={{ fontSize: 13 }}
              >
                <ExternalLink size={14} /> Abrir en pestaña
              </a>
            )}
            {signedUrl && (
              <button
                type="button"
                className="fert-btn fert-btn--primary"
                onClick={() => soilAnalysisStorageService.downloadPdf(pdfPath, fileName)}
              >
                <Download size={14} /> Descargar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SoilPdfViewer;

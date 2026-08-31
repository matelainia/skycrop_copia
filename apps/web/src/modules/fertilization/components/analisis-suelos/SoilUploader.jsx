import { memo, useState, useCallback, useRef } from 'react';
import { UploadCloud, FileText, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

const MAX_MB = 15;

const SoilUploader = memo(function SoilUploader({
  file,
  onFileSelect,
  onRemove,
  progress = null,
  error = null,
  disabled = false,
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const validate = useCallback((f) => {
    if (!f) return 'Archivo requerido.';
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      return 'Solo se permiten archivos PDF.';
    }
    if (f.size > MAX_MB * 1024 * 1024) return `El archivo excede ${MAX_MB} MB.`;
    return null;
  }, []);

  const handleFiles = useCallback((files) => {
    const f = files?.[0];
    if (!f) return;
    const err = validate(f);
    if (err) {
      onFileSelect?.(null, err);
      return;
    }
    onFileSelect?.(f, null);
  }, [validate, onFileSelect]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }, [disabled, handleFiles]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const onInputChange = useCallback((e) => {
    handleFiles(e.target.files);
    // reset para permitir re-seleccionar el mismo archivo
    e.target.value = '';
  }, [handleFiles]);

  if (file) {
    return (
      <div className="soil-uploader__file" role="status" aria-label="Archivo seleccionado">
        <div className="soil-doc-card__icon">PDF</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB · PDF</div>
          {progress != null && progress < 100 && (
            <div className="soil-uploader__progress">
              <div className="soil-uploader__progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}
          {progress === 100 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#059669', marginTop: 6 }}>
              <CheckCircle2 size={12} /> Informe cargado correctamente
            </div>
          )}
        </div>
        {!disabled && (
          <button type="button" className="fert-btn fert-btn--ghost fert-btn--icon" onClick={onRemove} aria-label="Eliminar archivo">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`soil-uploader ${dragging ? 'soil-uploader--dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Seleccionar PDF"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <div className="soil-uploader__icon"><UploadCloud size={20} /></div>
        <div className="soil-uploader__title">Arrastra el análisis aquí</div>
        <div className="soil-uploader__subtitle">o selecciona un archivo</div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>PDF · Máx. {MAX_MB} MB</div>
        <button
          type="button"
          className="fert-btn fert-btn--outline"
          style={{ marginTop: 8, fontSize: 12 }}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          disabled={disabled}
        >
          Seleccionar archivo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#DC2626', marginTop: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
    </div>
  );
});

export default SoilUploader;

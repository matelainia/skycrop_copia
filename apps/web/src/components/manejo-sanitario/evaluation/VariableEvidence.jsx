import React, { useRef } from 'react';
import { Camera, Trash2, Maximize2, Plus } from 'lucide-react';

/**
 * VariableEvidence
 * Zona de fotografías para una variable de evaluación.
 * - Sin fotos: muestra dropzone
 * - Con fotos: miniaturas + acciones
 *
 * @param {{ photos: string[], onAdd: (file: File) => void, onRemove: (idx: number) => void, onPreview: (idx: number) => void }} props
 */
const VariableEvidence = ({ photos = [], onAdd, onRemove, onPreview }) => {
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onAdd) onAdd(file);
    e.target.value = '';
  };

  if (photos.length === 0) {
    return (
      <div className="eval-evidence-zone">
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="eval-evidence-empty"
          onClick={() => fileRef.current?.click()}
          aria-label="Subir fotografía"
        >
          <Camera size={16} />
          <span>Foto</span>
        </button>
      </div>
    );
  }

  return (
    <div className="eval-evidence-zone">
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {photos.map((src, idx) => (
          <div key={idx} style={{ position: 'relative' }}>
            <img
              src={src}
              alt={`Evidencia ${idx + 1}`}
              className="eval-evidence-thumb"
              onClick={() => onPreview?.(idx)}
            />
            <button
              type="button"
              onClick={() => onRemove?.(idx)}
              style={{
                position: 'absolute',
                top: -5, right: -5,
                width: 18, height: 18,
                borderRadius: '50%',
                background: '#ef4444',
                border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}
              aria-label="Eliminar foto"
            >
              <Trash2 size={9} />
            </button>
          </div>
        ))}
      </div>

      <div className="eval-evidence-actions">
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="eval-evidence-btn"
          onClick={() => fileRef.current?.click()}
          title="Agregar foto"
        >
          <Plus size={10} /> Agregar
        </button>
        <button
          type="button"
          className="eval-evidence-btn"
          onClick={() => onPreview?.(0)}
          title="Vista previa"
        >
          <Maximize2 size={10} /> Vista
        </button>
      </div>
    </div>
  );
};

export default VariableEvidence;

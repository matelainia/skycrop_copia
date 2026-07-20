import React from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * EvidenceGallery
 * Gallery grid compacto para el panel lateral.
 * Muestra hasta 5 fotos + contador del resto.
 *
 * @param {{ photos: string[], onPreview: (idx: number) => void }} props
 */
const EvidenceGallery = ({ photos = [], onPreview }) => {
  const MAX_VISIBLE = 5;
  const visible = photos.slice(0, MAX_VISIBLE);
  const extra   = photos.length - MAX_VISIBLE;

  if (photos.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        border: '1.5px dashed var(--border-color-hover)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        color: 'var(--text-muted)',
        fontSize: 12
      }}>
        <ImageIcon size={22} />
        <span>Sin evidencias aún</span>
      </div>
    );
  }

  return (
    <div className="eval-gallery-grid">
      {visible.map((src, idx) => (
        <div
          key={idx}
          className="eval-gallery-thumb"
          onClick={() => onPreview?.(idx)}
          title="Ver foto"
        >
          <img src={src} alt={`Evidencia ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ))}

      {extra > 0 && (
        <div
          className="eval-gallery-more"
          onClick={() => onPreview?.(MAX_VISIBLE)}
          title={`Ver ${extra} fotos más`}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};

export default EvidenceGallery;

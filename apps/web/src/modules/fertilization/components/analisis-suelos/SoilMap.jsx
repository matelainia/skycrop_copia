import { memo } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { geolocationService } from '../../services/geolocation.service.js';

const SoilMap = memo(function SoilMap({ latitude, longitude, accuracyM, ubicacionNombre, ubicacionDescripcion }) {
  const hasCoords = latitude != null && longitude != null;
  const osmUrl = hasCoords ? geolocationService.getOsmUrl(latitude, longitude) : null;
  const googleUrl = hasCoords ? geolocationService.getGoogleMapsUrl(latitude, longitude) : null;

  if (!hasCoords) {
    return (
      <div className="soil-map-card" style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>
        <MapPin size={20} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>Ubicación no registrada</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>El muestreo no tiene coordenadas GPS asociadas.</div>
      </div>
    );
  }

  return (
    <div className="soil-map-card" role="region" aria-label="Ubicación del muestreo">
      <div className="soil-map-placeholder" aria-hidden="true">
        <div className="soil-map-pin"><div className="soil-map-pin__inner" /></div>
      </div>
      <div className="soil-map-info">
        <div className="soil-map-info__title">{ubicacionNombre || 'Ubicación del muestreo'}</div>
        {ubicacionDescripcion && <div className="soil-map-info__desc">{ubicacionDescripcion}</div>}
        <div className="soil-map-info__coords">
          {Number(latitude).toFixed(6)}° N, {Number(longitude).toFixed(6)}° W
          {accuracyM != null && <span> · Precisión {accuracyM.toFixed(0)} m</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fert-btn fert-btn--outline"
            style={{ fontSize: 12, padding: '6px 10px' }}
          >
            <ExternalLink size={12} /> Ver en mapa
          </a>
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fert-btn fert-btn--ghost"
            style={{ fontSize: 12, padding: '6px 10px' }}
          >
            Google Maps
          </a>
        </div>
      </div>
    </div>
  );
});

export default SoilMap;

export const MiniMapPreview = memo(function MiniMapPreview({ latitude, longitude }) {
  const hasCoords = latitude != null && longitude != null;
  return (
    <div
      style={{
        width: 72, height: 72, borderRadius: 10, overflow: 'hidden',
        background: hasCoords ? 'linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)' : '#F3F4F6',
        border: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}
    >
      {hasCoords ? (
        <MapPin size={18} style={{ color: '#059669' }} />
      ) : (
        <MapPin size={16} style={{ color: '#9CA3AF' }} />
      )}
    </div>
  );
});

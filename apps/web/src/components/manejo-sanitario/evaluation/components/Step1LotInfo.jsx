import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Calendar } from 'lucide-react';

/* ── Utilidad ── */
const calcCropAge = (fechaSiembra) => {
  if (!fechaSiembra) return '—';
  const months =
    (new Date().getFullYear() - new Date(fechaSiembra).getFullYear()) * 12 +
    (new Date().getMonth() - new Date(fechaSiembra).getMonth());
  return months >= 0 ? `${months} meses` : '0 meses';
};

/* ───────────────────────────────────────────────────
   Step1LotInfo
   - Grid 2 columnas para los selects/campos
   - Sub-sección "Ubicación del lote" + mapa en 2 col
─────────────────────────────────────────────────── */
export default function Step1LotInfo({
  formData,
  setFormData,
  companies,
  predios,
  lotes,
  geoInfo,
  geoLoading,
  selectedLoteData
}) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const [layer,     setLayer]     = useState('satelite');   // 'satelite' | 'callejero'
  const [fullscreen, setFullscreen] = useState(false);
  const [copied,    setCopied]    = useState(false);

  /* ── Copiar coordenadas ── */
  const handleCopy = () => {
    if (!geoInfo?.coordenadas) return;
    navigator.clipboard.writeText(geoInfo.coordenadas);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Inicializar / actualizar mapa ── */
  useEffect(() => {
    if (!window.L || !mapRef.current) return;
    const L = window.L;

    // Destruir instancia previa
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const center = geoInfo?.centroide || [3.518, -76.305];
    const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 15);
    mapInstance.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Capa base
    if (layer === 'callejero') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);
    } else {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Esri, Maxar' }
      ).addTo(map);
    }

    // Polígono del lote
    if (selectedLoteData?.coordinates?.length > 0) {
      const poly = L.polygon(selectedLoteData.coordinates, {
        color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 3
      }).addTo(map);
      poly.bindTooltip(
        `<strong>Lote ${selectedLoteData.codigo_interno}</strong><br/>Área: ${selectedLoteData.area_ha} ha`,
        { sticky: true, direction: 'top' }
      );
      map.fitBounds(poly.getBounds(), { padding: [24, 24], animate: true });

      // Marcador centroide
      L.circleMarker(center, {
        radius: 7, fillColor: '#10b981', color: '#fff', fillOpacity: 1, weight: 2
      }).addTo(map);
    }

    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  }, [selectedLoteData?.id, layer, geoInfo]);

  /* ── Campo read-only genérico ── */
  const ReadField = ({ value }) => (
    <input
      type="text"
      className="input-glass"
      style={{ width: '100%' }}
      value={value ?? '—'}
      readOnly
      disabled
    />
  );

  return (
    <div className="step1-wrapper">

      {/* ── Grid de 2 columnas: Empresa / Predio / Lote / Área / Cultivo / Variedad / Fecha / Edad ── */}
      <div className="step1-form-grid">

        {/* Empresa */}
        <div>
          <label className="form-label">Empresa</label>
          <select
            className="input-glass select-glass"
            style={{ width: '100%' }}
            value={formData.companyId}
            onChange={e => setFormData(p => ({ ...p, companyId: e.target.value, predioId: '', loteId: '' }))}
          >
            <option value="" disabled>Seleccione empresa...</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Predio */}
        <div>
          <label className="form-label">Predio</label>
          <select
            className="input-glass select-glass"
            style={{ width: '100%' }}
            value={formData.predioId}
            onChange={e => setFormData(p => ({ ...p, predioId: e.target.value, loteId: '' }))}
            disabled={!formData.companyId}
          >
            <option value="">Seleccione predio...</option>
            {predios.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        {/* Lote / Sector */}
        <div>
          <label className="form-label">Lote / Sector <span style={{ color: 'var(--accent-red)' }}>*</span></label>
          <select
            className="input-glass select-glass"
            style={{ width: '100%' }}
            value={formData.loteId}
            onChange={e => setFormData(p => ({ ...p, loteId: e.target.value }))}
            disabled={!formData.predioId}
          >
            <option value="">Seleccione lote...</option>
            {lotes.map(l => (
              <option key={l.id} value={l.id}>
                {l.codigo_interno} — {l.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Área del lote */}
        <div>
          <label className="form-label">Área del lote</label>
          <ReadField value={selectedLoteData?.area_ha ? `${selectedLoteData.area_ha} ha` : null} />
        </div>

        {/* Cultivo (con ícono de hoja) */}
        <div>
          <label className="form-label">Cultivo</label>
          <div style={{ position: 'relative' }}>
            <ReadField
              value={selectedLoteData
                ? (selectedLoteData.cultivo_ref?.nombre_comun || selectedLoteData.cultivo)
                : null}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🌿</span>
          </div>
        </div>

        {/* Variedad */}
        <div>
          <label className="form-label">Variedad</label>
          <ReadField value={selectedLoteData?.variedad} />
        </div>

        {/* Fecha de siembra */}
        <div>
          <label className="form-label">Fecha de siembra</label>
          <div style={{ position: 'relative' }}>
            <ReadField
              value={selectedLoteData?.fecha_siembra
                ? new Date(selectedLoteData.fecha_siembra).toLocaleDateString('es-CO')
                : null}
            />
            <Calendar
              size={13}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
          </div>
        </div>

        {/* Edad del cultivo */}
        <div>
          <label className="form-label">Edad del cultivo</label>
          <ReadField value={calcCropAge(selectedLoteData?.fecha_siembra)} />
        </div>
      </div>

      {/* ── Sección Ubicación + Mapa ── */}
      <div className="step1-location-section">

        {/* Título de sección con link "Ver en el mapa" */}
        <div className="step1-location-header">
          <span className="step1-location-title">Ubicación del lote</span>
          <button
            type="button"
            className="step1-view-map-link"
            onClick={() => setFullscreen(true)}
          >
            Ver ubicación en el mapa →
          </button>
        </div>

        <div className="step1-location-body">

          {/* Columna de datos geográficos */}
          <div className="step1-geo-col">
            <GeoRow label="Departamento" value={geoInfo?.departamento || 'Valle del Cauca'} />
            <GeoRow label="Municipio"    value={geoInfo?.municipio    || 'Zarzal'} />
            <GeoRow label="Vereda"       value={geoInfo?.vereda       || 'La Paila'} />
            <div className="step1-geo-row">
              <span className="step1-geo-label">Coordenadas</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="step1-geo-value step1-geo-value--mono">
                  {geoInfo?.coordenadas || '4.3352, -76.1876'}
                </span>
                <button type="button" onClick={handleCopy} className="step1-copy-btn" title="Copiar coordenadas">
                  {copied
                    ? <Check size={12} style={{ color: 'var(--primary)' }} />
                    : <Copy size={12} style={{ color: 'var(--text-muted)' }} />
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Mapa Leaflet */}
          <div className="step1-map-col">
            {/* Controles de capa */}
            <div className="step1-map-layer-ctrl">
              <button
                type="button"
                className={`step1-layer-btn ${layer === 'satelite' ? 'active' : ''}`}
                onClick={() => setLayer('satelite')}
              >Satélite</button>
              <button
                type="button"
                className={`step1-layer-btn ${layer === 'callejero' ? 'active' : ''}`}
                onClick={() => setLayer('callejero')}
              >Calles</button>
            </div>

            {/* Contenedor del mapa */}
            <div className="step1-map-container">
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Modal Fullscreen ── */}
      {fullscreen && (
        <div className="step1-map-fullscreen">
          <div className="step1-map-fullscreen-header">
            <h3 style={{ color: '#fff', margin: 0, fontSize: 14, fontWeight: 700 }}>
              Lote: {selectedLoteData?.nombre || 'Vista de mapa'}
            </h3>
            <button
              type="button"
              className="eval-btn-primary-header"
              onClick={() => setFullscreen(false)}
            >
              Cerrar mapa
            </button>
          </div>
          <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-componente para filas geográficas ── */
function GeoRow({ label, value }) {
  return (
    <div className="step1-geo-row">
      <span className="step1-geo-label">{label}</span>
      <span className="step1-geo-value">{value || '—'}</span>
    </div>
  );
}
